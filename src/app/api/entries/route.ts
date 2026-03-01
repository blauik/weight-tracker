import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DailyEntry } from "@/types";

export async function PUT(req: NextRequest) {
  const entries: DailyEntry[] = await req.json();

  await prisma.$transaction(
    entries.map((entry) =>
      prisma.dailyEntry.upsert({
        where: { date: entry.date },
        update: { weight: entry.weight, note: entry.note ?? null },
        create: {
          date: entry.date,
          weight: entry.weight,
          note: entry.note ?? null,
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { date, weight }: { date: string; weight: number | null } =
    await req.json();

  await prisma.dailyEntry.upsert({
    where: { date },
    update: { weight },
    create: { date, weight },
  });

  return NextResponse.json({ ok: true });
}
