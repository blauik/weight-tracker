import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { calculateTotalDays, generateDateRange } from "@/lib/calculations";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const { newTargetWeight } = await req.json();

    // 1. Validation
    if (typeof newTargetWeight !== "number" || newTargetWeight <= 0) {
      return NextResponse.json({ error: "Invalid target weight" }, { status: 400 });
    }

    // 2. Load profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Validation: target must be < startWeight
    if (newTargetWeight >= profile.startWeight) {
      return NextResponse.json({
        error: "Target weight must be less than start weight"
      }, { status: 400 });
    }

    // 4. Load existing entries
    const existingEntries = await prisma.dailyEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    // 5. Calculate new total days with new target
    const newTotalDays = calculateTotalDays({
      ...profile,
      targetWeight: newTargetWeight,
      startDate: profile.startDate,
      startWeight: profile.startWeight,
      name: profile.name,
      gender: profile.gender as "male" | "female",
      age: profile.age,
      heightCm: profile.heightCm,
      activityLevel: profile.activityLevel as any,
    });

    const newDates = generateDateRange(profile.startDate, newTotalDays);

    // 6. Create map of existing weights
    const existingWeightsMap = new Map(
      existingEntries.map((e) => [e.date, { weight: e.weight, note: e.note }])
    );

    // 7. Generate new entries preserving existing weights
    const newEntries = newDates.map((date, index) => ({
      date,
      // First day always = startWeight, others preserve existing or null
      weight: index === 0 ? profile.startWeight : (existingWeightsMap.get(date)?.weight ?? null),
      note: index === 0 ? "Výchozí váha" : (existingWeightsMap.get(date)?.note ?? null),
    }));

    // 8. Atomic transaction: update profile + delete old entries + create new ones
    await prisma.$transaction(async (tx) => {
      // Update profile
      await tx.profile.update({
        where: { userId: user.id },
        data: { targetWeight: newTargetWeight },
      });

      // Delete all old entries
      await tx.dailyEntry.deleteMany({
        where: { userId: user.id },
      });

      // Create new entries
      await tx.dailyEntry.createMany({
        data: newEntries.map((e) => ({
          userId: user.id,
          date: e.date,
          weight: e.weight,
          note: e.note ?? undefined,
        })),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating target weight:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
