/**
 * Orderbook Sync Cron Job
 *
 * This endpoint is called by Vercel cron to periodically capture orderbook
 * snapshots from the Polymarket CLOB API to Firestore.
 *
 * Schedule: Every 5 minutes (configurable in vercel.json)
 *
 * Snapshots are point-in-time records and are always inserted (not deduplicated).
 */

import { NextResponse } from "next/server";
import { syncOrderbooksForAllMarkets } from "@/services/orderbook";
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
    // Sync orderbook snapshots from CLOB API for all active markets
    const result = await syncOrderbooksForAllMarkets({
      maxMarkets: 50,
      maxTokensPerMarket: 10,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${String(duration)}ms`,
      result: {
        totalTokens: result.totalTokens,
        successCount: result.successCount,
        failureCount: result.failureCount,
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

    console.error("[cron/orderbook] Sync failed:", errorMessage);

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
