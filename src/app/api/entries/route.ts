import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DailyEntry } from "@/types";
import { requireUser } from "@/lib/session";

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const entries: DailyEntry[] = await req.json();

    await prisma.$transaction(
      entries.map((entry) =>
        prisma.dailyEntry.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: entry.date,
            },
          },
          update: {
            weight: entry.weight,
            note: entry.note ?? null
          },
          create: {
            userId: user.id,
            date: entry.date,
            weight: entry.weight,
            note: entry.note ?? null,
          },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const { date, weight }: { date: string; weight: number | null } =
      await req.json();

    await prisma.dailyEntry.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date,
        },
      },
      update: { weight },
      create: {
        userId: user.id,
        date,
        weight
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
