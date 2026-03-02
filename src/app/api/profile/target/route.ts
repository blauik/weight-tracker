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

    // 8. First, delete entries that are no longer in the new range
    const newDateSet = new Set(newDates);
    await prisma.dailyEntry.deleteMany({
      where: {
        userId: user.id,
        date: {
          notIn: newDates,
        },
      },
    });

    // 9. Update profile and upsert all entries in transaction
    await prisma.$transaction(async (tx) => {
      // Update profile
      await tx.profile.update({
        where: { userId: user.id },
        data: { targetWeight: newTargetWeight },
      });

      // Upsert each entry (insert or update)
      for (const entry of newEntries) {
        const data: any = {
          weight: entry.weight,
        };
        // Only include note if it's not null
        if (entry.note !== null) {
          data.note = entry.note;
        }

        await tx.dailyEntry.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: entry.date,
            },
          },
          update: data,
          create: {
            userId: user.id,
            date: entry.date,
            ...data,
          },
        });
      }
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
