import {
  DEFAULT_ALERT_SENSITIVITY,
  FEATURE_WEIGHTS,
  getAlertThreshold,
  MUST_FLAG_THRESHOLDS,
} from "./config";
import type { ScoringInput, ScoringResult } from "./types";

/**
 * Normalize a value to 0-1 range using sigmoid-like scaling
 */
function normalize(value: number, median: number): number {
  if (median === 0) return 0;
  const ratio = value / median;
  // Sigmoid scaling: values at median = 0.5, 2x median ≈ 0.73, 5x median ≈ 0.91
  return 1 - 1 / (1 + ratio);
}

/**
 * Compute individual feature scores
 */
function extractFeatures(input: ScoringInput): Record<keyof typeof FEATURE_WEIGHTS, number> {
  const { trade, market, context } = input;

  // Trade size vs market median
  const tradeSizeVsMedian = normalize(trade.size, context.medianTradeSize);

  // Trade size vs available depth
  const relevantDepth = trade.side === "BUY" ? market.askDepth : market.bidDepth;
  const tradeSizeVsDepth = relevantDepth > 0 ? Math.min(trade.size / relevantDepth, 1) : 1;

  // Aggressiveness: crossing spread or taking liquidity
  const midPrice = (market.bestBid + market.bestAsk) / 2;
  const spread = market.bestAsk - market.bestBid;
  let aggressiveness = 0;
  if (spread > 0) {
    if (trade.side === "BUY" && trade.price >= market.bestAsk) {
      // Paid full ask - aggressive
      aggressiveness = 0.8 + 0.2 * Math.min((trade.price - market.bestAsk) / spread, 1);
    } else if (trade.side === "SELL" && trade.price <= market.bestBid) {
      // Hit full bid - aggressive
      aggressiveness = 0.8 + 0.2 * Math.min((market.bestBid - trade.price) / spread, 1);
    } else {
      // Somewhere in spread
      const distanceFromMid = Math.abs(trade.price - midPrice);
      aggressiveness = distanceFromMid / (spread / 2) * 0.5;
    }
  }

  // Wallet burst behavior
  const walletBurst = Math.min(context.walletTradesLastHour / 10, 1);

  // Position concentration
  const positionConcentration =
    context.totalLiquidity > 0
      ? Math.min(context.walletPosition / context.totalLiquidity, 1)
      : 0;

  // Ramp speed (position change in last hour)
  const positionDelta = Math.abs(context.walletPosition - context.walletPositionHourAgo);
  const rampSpeed = context.medianTradeSize > 0 ? normalize(positionDelta, context.medianTradeSize * 5) : 0;

  // Wallet freshness (new wallets are more suspicious)
  let walletFreshness = 0;
  if (context.walletAgeDays !== null) {
    if (context.walletAgeDays < 1) {
      walletFreshness = 1;
    } else if (context.walletAgeDays < 7) {
      walletFreshness = 0.8;
    } else if (context.walletAgeDays < 30) {
      walletFreshness = 0.4;
    } else {
      walletFreshness = 0.1;
    }
  }

  // Dollar value (absolute size matters)
  const dollarValue = normalize(context.tradeUsdValue, 5000);

  return {
    tradeSizeVsMedian,
    tradeSizeVsDepth,
    aggressiveness,
    walletBurst,
    positionConcentration,
    rampSpeed,
    walletFreshness,
    dollarValue,
  };
}

/**
 * Check must-flag conditions that bypass scoring
 */
function checkMustFlag(
  input: ScoringInput
): { mustFlag: boolean; condition?: string } {
  const { context } = input;

  // Single trade > $25k
  if (context.tradeUsdValue > MUST_FLAG_THRESHOLDS.singleTradeUsd) {
    const threshold = MUST_FLAG_THRESHOLDS.singleTradeUsd.toLocaleString();
    return { mustFlag: true, condition: `Single trade > $${threshold}` };
  }

  // Hourly accumulation > $50k
  const hourlyDelta = Math.abs(context.walletPosition - context.walletPositionHourAgo) * input.trade.price;
  if (hourlyDelta > MUST_FLAG_THRESHOLDS.hourlyAccumulationUsd) {
    const threshold = MUST_FLAG_THRESHOLDS.hourlyAccumulationUsd.toLocaleString();
    return { mustFlag: true, condition: `Accumulated > $${threshold} in 1 hour` };
  }

  // New wallet making large trade
  if (
    context.walletAgeDays !== null &&
    context.walletAgeDays < MUST_FLAG_THRESHOLDS.newWalletAgeDays &&
    context.tradeUsdValue > MUST_FLAG_THRESHOLDS.newWalletTradeUsd
  ) {
    const ageDays = context.walletAgeDays.toString();
    const threshold = MUST_FLAG_THRESHOLDS.newWalletTradeUsd.toLocaleString();
    return { mustFlag: true, condition: `New wallet (${ageDays}d old) traded > $${threshold}` };
  }

  // Position > 5% of market liquidity
  if (context.totalLiquidity > 0) {
    const positionPercent = (context.walletPosition / context.totalLiquidity) * 100;
    if (positionPercent > MUST_FLAG_THRESHOLDS.positionLiquidityPercent) {
      const percentStr = positionPercent.toFixed(1);
      return { mustFlag: true, condition: `Position is ${percentStr}% of market liquidity` };
    }
  }

  return { mustFlag: false };
}

/**
 * Generate human-readable reasons from feature scores
 */
function generateReasons(
  features: Record<keyof typeof FEATURE_WEIGHTS, number>,
  mustFlagResult: { mustFlag: boolean; condition?: string }
): ScoringResult["reasons"] {
  const factors: string[] = [];

  if (features.tradeSizeVsMedian > 0.7) {
    factors.push("Trade significantly larger than market median");
  }
  if (features.tradeSizeVsDepth > 0.5) {
    factors.push("Trade consumes substantial orderbook depth");
  }
  if (features.aggressiveness > 0.7) {
    factors.push("Aggressive execution (crossing spread)");
  }
  if (features.walletBurst > 0.5) {
    factors.push("Rapid trading activity from wallet");
  }
  if (features.positionConcentration > 0.3) {
    factors.push("High position concentration");
  }
  if (features.rampSpeed > 0.5) {
    factors.push("Fast position accumulation");
  }
  if (features.walletFreshness > 0.7) {
    factors.push("New or recently active wallet");
  }
  if (features.dollarValue > 0.7) {
    factors.push("Large absolute trade value");
  }

  // Sort by weight to find primary reason
  const weightedScores = Object.entries(features)
    .map(([key, value]) => ({
      key,
      weighted: value * FEATURE_WEIGHTS[key as keyof typeof FEATURE_WEIGHTS],
    }))
    .sort((a, b) => b.weighted - a.weighted);

  const primaryKey = weightedScores[0]?.key ?? "tradeSizeVsMedian";
  const primaryReasonMap: Record<string, string> = {
    tradeSizeVsMedian: "Unusually large trade size",
    tradeSizeVsDepth: "Trade consumes significant liquidity",
    aggressiveness: "Aggressive trade execution",
    walletBurst: "Burst of trading activity",
    positionConcentration: "Concentrated position",
    rampSpeed: "Rapid position building",
    walletFreshness: "New wallet activity",
    dollarValue: "High-value trade",
  };

  return {
    primary: mustFlagResult.mustFlag && mustFlagResult.condition
      ? mustFlagResult.condition
      : primaryReasonMap[primaryKey] ?? "Anomalous trading pattern",
    factors,
    mustFlag: mustFlagResult.mustFlag,
    mustFlagCondition: mustFlagResult.condition,
  };
}

/**
 * Score a trade for anomaly detection
 */
export function scoreTrade(
  input: ScoringInput,
  sensitivity: number = DEFAULT_ALERT_SENSITIVITY
): ScoringResult {
  // Extract features
  const features = extractFeatures(input);

  // Compute weighted score
  let score = 0;
  for (const [key, weight] of Object.entries(FEATURE_WEIGHTS)) {
    score += features[key as keyof typeof FEATURE_WEIGHTS] * weight;
  }

  // Check must-flag conditions
  const mustFlagResult = checkMustFlag(input);

  // Determine if should alert
  const threshold = getAlertThreshold(sensitivity);
  const shouldAlert = mustFlagResult.mustFlag || score >= threshold;

  // Generate reasons
  const reasons = generateReasons(features, mustFlagResult);

  return {
    score,
    features,
    shouldAlert,
    reasons,
  };
}
