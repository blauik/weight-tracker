import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppState, Gender, ActivityLevel } from "@/types";

export async function GET() {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  const entries = await prisma.dailyEntry.findMany({
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
}

export async function DELETE() {
  await prisma.$transaction([
    prisma.dailyEntry.deleteMany(),
    prisma.profile.deleteMany(),
  ]);

  return NextResponse.json({ ok: true });
}
