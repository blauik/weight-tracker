import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppState, Gender, ActivityLevel } from "@/types";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    const entries = await prisma.dailyEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    const state: AppState = {
      profile: profile
        ? {
            name: profile.name,
            gender: profile.gender as Gender,
            age: profile.age,
            heightCm: profile.heightCm,
            startWeight: profile.startWeight,
            targetWeight: profile.targetWeight,
            activityLevel: profile.activityLevel as ActivityLevel,
            startDate: profile.startDate,
          }
        : null,
      entries: entries.map((e) => ({
        date: e.date,
        weight: e.weight,
        note: e.note ?? undefined,
      })),
    };

    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();

    await prisma.$transaction([
      prisma.dailyEntry.deleteMany({ where: { userId: user.id } }),
      prisma.profile.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
