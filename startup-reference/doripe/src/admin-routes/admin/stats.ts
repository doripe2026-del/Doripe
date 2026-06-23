import { NextResponse } from "../../admin-server/response.js";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { getLegacyAdminStats } from "../../admin-server/legacyStats.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  try {
    const stats = await getLegacyAdminStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json({
      campaigns: [],
      error: error instanceof Error ? error.message : "Stats unavailable",
      funnel: [],
      insights: {
        age: [],
        betaCommitments: [],
        betaResults: [],
        features: [],
        gender: [],
        opinions: [],
        painPoints: [],
        recentSearchMethods: [],
        region: [],
        saveLocations: [],
      },
      kpi: {
        arrivals: 0,
        conversionRate: 0,
        pageViews: 0,
        signups: 0,
        todayArrivals: 0,
        todayPageViews: 0,
        todaySignups: 0,
      },
      recentSignups: [],
      timeline: [],
      version: "v2",
    }, { status: 200 });
  }
}
