import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserProfile } from "@/types";
import { requireUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const profile: UserProfile = await req.json();

    await prisma.profile.upsert({
      where: { userId: user.id },
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
        userId: user.id,
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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
