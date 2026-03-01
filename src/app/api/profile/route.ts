import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserProfile } from "@/types";

export async function POST(req: NextRequest) {
  const profile: UserProfile = await req.json();

  await prisma.profile.upsert({
    where: { id: 1 },
    update: {
      name: profile.name,
      gender: profile.gender,
      age: profile.age,
      heightCm: profile.heightCm,
      startWeight: profile.startWeight,
      targetWeight: profile.targetWeight,
      activityLevel: profile.activityLevel,
      startDate: profile.startDate,
    },
    create: {
      id: 1,
      name: profile.name,
      gender: profile.gender,
      age: profile.age,
      heightCm: profile.heightCm,
      startWeight: profile.startWeight,
      targetWeight: profile.targetWeight,
      activityLevel: profile.activityLevel,
      startDate: profile.startDate,
    },
  });

  return NextResponse.json({ ok: true });
}
