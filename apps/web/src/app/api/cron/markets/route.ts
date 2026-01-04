/**
 * Market Sync Cron Job
 *
 * This endpoint is called by Vercel cron to periodically sync markets
 * from the Polymarket Gamma API to Firestore.
 *
 * Schedule: Every 15 minutes (configurable in vercel.json)
 *
 * The sync is idempotent - markets are upserted, not duplicated.
 */

import { NextResponse } from "next/server";
import { syncMarketsFromGamma } from "@/services/markets";
import { env } from "@/env";

/**
 * Force dynamic rendering - this route should never be statically analyzed
 * because it depends on runtime environment variables and external services.
 */
export const dynamic = "force-dynamic";

/**
 * Get CRON_SECRET from environment (optional)
 */
function getCronSecret(): string | undefined {
  // Use index access to avoid TypeScript strict indexing issue
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
    // Sync markets from Gamma API to Firestore
    const result = await syncMarketsFromGamma();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${String(duration)}ms`,
      result: {
        totalFetched: result.totalFetched,
        markets: {
          created: result.markets.created,
          updated: result.markets.updated,
        },
        tokens: {
          created: result.tokens.created,
          updated: result.tokens.updated,
        },
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[cron/markets] Sync failed:", errorMessage);

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
