import { NextResponse } from "next/server";
import { getTodayFixtures } from "@/lib/api-football";

export const dynamic = "force-dynamic";

export async function GET() {
  const fixtures = await getTodayFixtures();

  return NextResponse.json(
    {
      date: new Date().toISOString(),
      count: fixtures.length,
      fixtures,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
