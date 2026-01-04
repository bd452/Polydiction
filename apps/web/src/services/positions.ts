/**
 * Position Polling Service
 *
 * Computes and stores wallet position snapshots based on trade activity.
 * Positions are calculated by aggregating trades for each wallet/token pair.
 *
 * Note: Polymarket doesn't provide a direct public positions API,
 * so we derive positions from trade history.
 */

import { queries, type NewWalletPosition, type Trade } from "@polydiction/db";
import { Timestamp } from "firebase-admin/firestore";

const { batchInsertPositionSnapshots, getActiveMarkets, getTradesByMarket } = queries;

// ============================================================================
// Types
// ============================================================================

/**
 * Aggregated position for a wallet in a token
 */
export interface WalletTokenPosition {
  wallet: string;
  tokenId: string;
  marketId: string;
  position: string;
  buyVolume: string;
  sellVolume: string;
  tradeCount: number;
  avgPrice: string | null;
}

/**
 * Result of computing positions for a market
 */
export interface MarketPositionsResult {
  marketId: string;
  positions: WalletTokenPosition[];
  walletsProcessed: number;
}

/**
 * Result of syncing positions across all markets
 */
export interface SyncAllPositionsResult {
  markets: { marketId: string; positionsInserted: number }[];
  totalMarkets: number;
  totalPositions: number;
  errors: { marketId: string; error: string }[];
}

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Computes positions for all wallets from trades
 *
 * Position = Sum of buys - Sum of sells
 * For takers: BUY adds to position, SELL removes from position
 * For makers: SELL adds to position (they sold/provided), BUY removes
 */
function computePositionsFromTrades(
  trades: Trade[],
  marketId: string
): Map<string, Map<string, WalletTokenPosition>> {
  // Map: wallet -> tokenId -> position data
  const positionsByWallet = new Map<string, Map<string, WalletTokenPosition>>();

  for (const trade of trades) {
    // Process taker position
    updatePosition(positionsByWallet, {
      wallet: trade.taker,
      tokenId: trade.tokenId,
      marketId,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      isTaker: true,
    });

    // Process maker position (opposite side)
    updatePosition(positionsByWallet, {
      wallet: trade.maker,
      tokenId: trade.tokenId,
      marketId,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      isTaker: false,
    });
  }

  return positionsByWallet;
}

/**
 * Updates a wallet's position based on a trade
 */
function updatePosition(
  positionsByWallet: Map<string, Map<string, WalletTokenPosition>>,
  params: {
    wallet: string;
    tokenId: string;
    marketId: string;
    side: string;
    size: string;
    price: string;
    isTaker: boolean;
  }
): void {
  const { wallet, tokenId, marketId, side, size, price, isTaker } = params;

  // Skip empty wallets
  if (!wallet || wallet === "0x0000000000000000000000000000000000000000") {
    return;
  }

  // Get or create wallet positions map
  let walletPositions = positionsByWallet.get(wallet);
  if (!walletPositions) {
    walletPositions = new Map();
    positionsByWallet.set(wallet, walletPositions);
  }

  // Get or create position for this token
  let position = walletPositions.get(tokenId);
  if (!position) {
    position = {
      wallet,
      tokenId,
      marketId,
      position: "0",
      buyVolume: "0",
      sellVolume: "0",
      tradeCount: 0,
      avgPrice: null,
    };
    walletPositions.set(tokenId, position);
  }

  const sizeNum = parseFloat(size);
  const priceNum = parseFloat(price);
  let positionNum = parseFloat(position.position);
  let buyVol = parseFloat(position.buyVolume);
  let sellVol = parseFloat(position.sellVolume);

  // Determine effective side for this wallet
  // Taker: BUY means they bought, SELL means they sold
  // Maker: BUY means taker bought from them (maker sold), SELL means taker sold to them (maker bought)
  const effectiveBuy = (isTaker && side === "BUY") || (!isTaker && side === "SELL");

  if (effectiveBuy) {
    positionNum += sizeNum;
    buyVol += sizeNum;
  } else {
    positionNum -= sizeNum;
    sellVol += sizeNum;
  }

  position.position = positionNum.toString();
  position.buyVolume = buyVol.toString();
  position.sellVolume = sellVol.toString();
  position.tradeCount++;

  // Calculate weighted average price (simplified: just use last price for now)
  // A more accurate implementation would track cost basis
  if (effectiveBuy && sizeNum > 0) {
    position.avgPrice = priceNum.toString();
  }
}

/**
 * Filters positions to only include significant positions
 * (to avoid storing dust positions)
 */
function filterSignificantPositions(
  positionsByWallet: Map<string, Map<string, WalletTokenPosition>>,
  minPositionSize = 0.01
): WalletTokenPosition[] {
  const significantPositions: WalletTokenPosition[] = [];

  for (const [, tokenPositions] of positionsByWallet) {
    for (const [, position] of tokenPositions) {
      const posSize = Math.abs(parseFloat(position.position));
      if (posSize >= minPositionSize) {
        significantPositions.push(position);
      }
    }
  }

  return significantPositions;
}

// ============================================================================
// Position Sync Functions
// ============================================================================

/**
 * Computes and stores position snapshots for a market
 *
 * @param marketId - Market condition ID
 * @param options - Sync options
 * @returns Result with inserted position count
 */
export async function syncPositionsForMarket(
  marketId: string,
  options: {
    /** Number of recent trades to analyze */
    tradeLimit?: number;
    /** Minimum position size to store */
    minPositionSize?: number;
  } = {}
): Promise<{ marketId: string; positionsInserted: number }> {
  const { tradeLimit = 1000, minPositionSize = 0.01 } = options;

  // Get recent trades for this market
  const trades = await getTradesByMarket(marketId, { limit: tradeLimit });

  if (trades.length === 0) {
    return { marketId, positionsInserted: 0 };
  }

  // Compute positions from trades
  const positionsByWallet = computePositionsFromTrades(trades, marketId);

  // Filter to significant positions only
  const significantPositions = filterSignificantPositions(positionsByWallet, minPositionSize);

  if (significantPositions.length === 0) {
    return { marketId, positionsInserted: 0 };
  }

  // Convert to DB format
  const now = Timestamp.now();
  const dbPositions: NewWalletPosition[] = significantPositions.map((pos) => ({
    wallet: pos.wallet,
    marketId: pos.marketId,
    tokenId: pos.tokenId,
    position: pos.position,
    avgPrice: pos.avgPrice ?? undefined,
    timestamp: now,
  }));

  // Insert position snapshots
  const ids = await batchInsertPositionSnapshots(dbPositions);

  return {
    marketId,
    positionsInserted: ids.length,
  };
}

/**
 * Computes and stores position snapshots for all active markets
 *
 * This is the main entry point for the positions sync cron job.
 *
 * @param options - Sync options
 * @returns Sync result with counts and any errors
 */
export async function syncPositionsForAllMarkets(options: {
  /** Maximum number of markets to process */
  maxMarkets?: number;
  /** Number of recent trades to analyze per market */
  tradeLimit?: number;
  /** Minimum position size to store */
  minPositionSize?: number;
} = {}): Promise<SyncAllPositionsResult> {
  const { maxMarkets = 50, tradeLimit = 1000, minPositionSize = 0.01 } = options;

  // Get all active markets
  const activeMarkets = await getActiveMarkets();

  // Limit the number of markets processed per run
  const marketsToProcess = activeMarkets.slice(0, maxMarkets);

  const results: { marketId: string; positionsInserted: number }[] = [];
  const errors: { marketId: string; error: string }[] = [];

  let totalPositions = 0;

  // Process markets sequentially
  for (const market of marketsToProcess) {
    try {
      const result = await syncPositionsForMarket(market.id, {
        tradeLimit,
        minPositionSize,
      });

      results.push(result);
      totalPositions += result.positionsInserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error syncing positions for market ${market.id}:`, errorMessage);
      errors.push({
        marketId: market.id,
        error: errorMessage,
      });
    }
  }

  return {
    markets: results,
    totalMarkets: marketsToProcess.length,
    totalPositions,
    errors,
  };
}

/**
 * Gets computed positions for a specific market (without storing)
 *
 * @param marketId - Market condition ID
 * @param options - Computation options
 * @returns Computed positions
 */
export async function getComputedPositions(
  marketId: string,
  options: { tradeLimit?: number; minPositionSize?: number } = {}
): Promise<WalletTokenPosition[]> {
  const { tradeLimit = 1000, minPositionSize = 0.01 } = options;

  const trades = await getTradesByMarket(marketId, { limit: tradeLimit });

  if (trades.length === 0) {
    return [];
  }

  const positionsByWallet = computePositionsFromTrades(trades, marketId);
  return filterSignificantPositions(positionsByWallet, minPositionSize);
}

/**
 * Gets top holders for a market based on computed positions
 *
 * @param marketId - Market condition ID
 * @param options - Options
 * @returns Top holders sorted by total position
 */
export async function getTopHoldersFromTrades(
  marketId: string,
  options: { limit?: number; tradeLimit?: number } = {}
): Promise<{ wallet: string; totalPosition: string; tokens: { tokenId: string; position: string }[] }[]> {
  const { limit = 20, tradeLimit = 2000 } = options;

  const positions = await getComputedPositions(marketId, { tradeLimit, minPositionSize: 0 });

  // Group by wallet
  const byWallet = new Map<string, { wallet: string; tokens: Map<string, number> }>();

  for (const pos of positions) {
    let walletData = byWallet.get(pos.wallet);
    if (!walletData) {
      walletData = { wallet: pos.wallet, tokens: new Map() };
      byWallet.set(pos.wallet, walletData);
    }
    walletData.tokens.set(pos.tokenId, parseFloat(pos.position));
  }

  // Calculate totals and format
  const holders = Array.from(byWallet.values()).map((walletData) => {
    const total = Array.from(walletData.tokens.values()).reduce(
      (sum, pos) => sum + Math.abs(pos),
      0
    );
    const tokens = Array.from(walletData.tokens.entries()).map(([tokenId, position]) => ({
      tokenId,
      position: position.toString(),
    }));

    return {
      wallet: walletData.wallet,
      totalPosition: total.toString(),
      tokens,
    };
  });

  // Sort by total position descending
  holders.sort((a, b) => parseFloat(b.totalPosition) - parseFloat(a.totalPosition));

  return holders.slice(0, limit);
}
