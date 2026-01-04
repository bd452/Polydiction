/**
 * Trade Sync Cron Job
 *
 * This endpoint is called by Vercel cron to periodically sync trades
 * from the Polymarket CLOB API to Firestore.
 *
 * Schedule: Every 5 minutes (configurable in vercel.json)
 *
 * The sync is idempotent - trades are deduplicated by ID.
 */

import { NextResponse } from "next/server";
import { syncTradesForAllMarkets } from "@/services/trades";
import { env } from "@/env";

/**
 * Ensure this route is never statically rendered.
 */
export const dynamic = "force-dynamic";

/**
 * Get CRON_SECRET from environment (optional)
 */
function getCronSecret(): string | undefined {
  return process.env["CRON_SECRET"];
}

/**
 * Vercel cron jobs require authentication via CRON_SECRET
 * to prevent unauthorized access.
 */
function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = getCronSecret();

  // If CRON_SECRET is not set, allow in development only
  if (!cronSecret) {
    return !env.isProduction;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  // Validate cron secret
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Sync trades from CLOB API to Firestore for all active markets
    const result = await syncTradesForAllMarkets({
      maxMarkets: 100,
      maxPagesPerMarket: 10,
    });

    const duration = Date.now() - startTime;

    // Build summary of markets with new trades
    const marketsWithTrades = result.markets.filter((m) => m.fetched > 0).length;

    return NextResponse.json({
      success: true,
      duration: `${String(duration)}ms`,
      result: {
        totalMarkets: result.totalMarkets,
        marketsWithTrades,
        totalFetched: result.totalFetched,
        totalInserted: result.totalInserted,
        duplicatesSkipped: result.totalFetched - result.totalInserted,
        errors: result.errors.length,
      },
      // Include error details if any
      ...(result.errors.length > 0 && {
        errorDetails: result.errors.slice(0, 10), // Limit to first 10 errors
      }),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[cron/trades] Sync failed:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        duration: `${String(duration)}ms`,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Vercel cron uses GET requests, but we also support POST for manual triggers
export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}
