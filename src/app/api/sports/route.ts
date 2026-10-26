import { NextResponse } from "next/server";
import { SPORTS, isSportConfigured } from "@/sports/registry";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    sports: SPORTS.map((sport) => ({
      slug: sport.slug,
      name: sport.name,
      status: sport.status,
      configured: isSportConfigured(sport),
    })),
  });
}
