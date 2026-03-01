# WeightFlow - Implementační Guide pro Nové Funkce
## ULTRA MEGA BIG BRAIN EDITION

> **Určeno pro:** Claude Opus instance
> **Složitost:** Vysoká
> **Dopad:** Celá aplikace
> **Verze dokumentu:** 1.0.0
> **Datum:** 2026-03-01

---

## 📋 EXECUTIVE SUMMARY

Tento dokument obsahuje kompletní implementační plán pro tři nové funkce aplikace WeightFlow:

1. **Editace váhového cíle** - Uživatel může měnit `targetWeight` a všechny dotčené údaje se automaticky přepočítají
2. **První den s automatickou váhou** - První záznam se vyplní automaticky hodnotou `startWeight` z onboarding formuláře
3. **Týdenní váhové průměry** - Nová karta zobrazující aktuální a historické týdenní průměry

### Celkový rozsah změn:
- **Nových souborů:** 3 (komponenty + API endpoint)
- **Upravených souborů:** 7
- **Nových funkcí:** 5
- **Databázové změny:** 0 (stávající schema dostačuje)
- **Odhadovaná doba:** 4-6 hodin implementace

---

## 🏗️ SOUČASNÁ ARCHITEKTURA - KOMPLETNÍ ANALÝZA

### Datový Model (Prisma PostgreSQL)

```prisma
model Profile {
  id            String   @id @default(cuid())
  userId        String   @unique
  name          String
  gender        String   // "male" | "female"
  age           Int
  heightCm      Int
  startWeight   Float    // ⭐ Počáteční váha
  targetWeight  Float    // ⭐ Cílová váha (budeme editovat)
  activityLevel String   // "sedentary" | "light" | "moderate" | "active" | "very_active"
  startDate     String   // ISO format YYYY-MM-DD
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model DailyEntry {
  id        String  @id @default(cuid())
  userId    String
  date      String  // ISO format YYYY-MM-DD
  weight    Float?  // ⭐ Nullable - null = nevyplněno
  note      String?
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, date])
}
```

### Klíčové Výpočty a Jejich Závislost na `targetWeight`

#### 1. `calculateTotalDays(profile)` - Celkový počet dní plánu
```typescript
// src/lib/calculations.ts:45-49
export function calculateTotalDays(profile: UserProfile): number {
  const totalKgToLose = profile.startWeight - profile.targetWeight;  // ⚠️ ZÁVISLÉ
  const totalKcalDeficit = totalKgToLose * KCAL_PER_KG;
  return Math.ceil(totalKcalDeficit / DEFICIT);
}
```
**Dopad změny:** Změna `targetWeight` mění celkový počet dní → mění rozsah `entries[]`

#### 2. `getIdealWeightForDate(profile, date)` - Ideální váha pro konkrétní datum
```typescript
// src/lib/calculations.ts:179-185
export function getIdealWeightForDate(profile: UserProfile, date: string): number {
  const start = new Date(profile.startDate).getTime();
  const current = new Date(date).getTime();
  const dayNum = (current - start) / (1000 * 60 * 60 * 24);
  const idealDailyLoss = DEFICIT / KCAL_PER_KG; // 0.0649 kg/den
  return Math.max(profile.targetWeight, profile.startWeight - idealDailyLoss * dayNum);  // ⚠️ ZÁVISLÉ
}
```
**Dopad změny:** Změna `targetWeight` mění ideální křivku na grafu a v tabulce

#### 3. `generateInitialEntries(profile)` - Generuje placeholder záznamy
```typescript
// src/lib/calculations.ts:62-66
export function generateInitialEntries(profile: UserProfile): DailyEntry[] {
  const totalDays = calculateTotalDays(profile);  // ⚠️ ZÁVISLÉ
  const dates = generateDateRange(profile.startDate, totalDays);
  return dates.map((date) => ({ date, weight: null }));  // ⭐ Všechny null
}
```
**Současný problém:** První den má `weight: null`, uživatel musí vyplnit ručně

#### 4. `calculateProjection(profile, entries)` - Projekce a statistiky
```typescript
// src/lib/calculations.ts:72-177
const totalToLose = profile.startWeight - profile.targetWeight;  // ⚠️ ZÁVISLÉ
const remaining = latestWeight - profile.targetWeight;  // ⚠️ ZÁVISLÉ
const percentComplete = (totalLost / totalToLose) * 100;  // ⚠️ ZÁVISLÉ
```
**Dopad změny:** Změna `targetWeight` mění všechny projekce, progress bar, statistiky

### API Endpointy

#### POST `/api/profile` - Vytvoření/aktualizace profilu
```typescript
// Existující kód - upsert
await prisma.profile.upsert({
  where: { userId: user.id },
  update: profileData,  // ✅ Podporuje update targetWeight
  create: { userId: user.id, ...profileData }
});
```
**Stav:** Již podporuje update, jen ho nikde nepoužíváme

#### PUT `/api/entries` - Batch upsert záznamů
```typescript
// Atomická transakce pro všechny entries
await prisma.$transaction(
  entries.map((e) =>
    prisma.dailyEntry.upsert({
      where: { userId_date: { userId: user.id, date: e.date } },
      update: { weight: e.weight, note: e.note },
      create: { userId: user.id, ...e }
    })
  )
);
```
**Použití:** Při změně `targetWeight` přegenerujeme entries

### Data Flow - Jak funguje aplikace

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ONBOARDING (OnboardingForm.tsx)                             │
├─────────────────────────────────────────────────────────────────┤
│ User vyplní: name, gender, age, heightCm,                       │
│              startWeight, targetWeight, activityLevel           │
│ ↓                                                               │
│ handleOnboardingComplete() v HomeClient.tsx                     │
│ ↓                                                               │
│ generateInitialEntries(profile) → DailyEntry[] s weight: null   │
│ ↓                                                               │
│ saveProfile(profile) → POST /api/profile                        │
│ saveEntries(entries) → PUT /api/entries                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. DASHBOARD (Dashboard.tsx + komponenty)                      │
├─────────────────────────────────────────────────────────────────┤
│ HomeClient.tsx:                                                 │
│   useEffect → loadState() → GET /api/state                      │
│   ↓                                                             │
│   setProfile(state.profile)                                     │
│   setEntries(state.entries)                                     │
│                                                                 │
│ Dashboard.tsx:                                                  │
│   Přijímá: profile, entries, setEntries, onReset                │
│   ↓                                                             │
│   Počítá: calorieInfo, totalDays, progress                      │
│   ↓                                                             │
│   Renderuje:                                                    │
│     - Stats karty (Start, Cíl, Celkem shodit, ...)              │
│     - WeightChart (graf s ideální křivkou)                      │
│     - WeeklyChart (týdenní změny)                               │
│     - WeightTable (editovatelná tabulka)                        │
│     - ProgressSection (progress bar, kalorie, projekce)         │
│                                                                 │
│ WeightTable.tsx:                                                │
│   Uživatel klikne na datum → zadá váhu → Enter                  │
│   ↓                                                             │
│   handleUpdateEntry(date, weight) v Dashboard                   │
│   ↓                                                             │
│   updateEntry(date, weight) → PATCH /api/entries                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3. VÝPOČTY (calculations.ts) - REAKTIVNĚ                        │
├─────────────────────────────────────────────────────────────────┤
│ Všechny komponenty volají funkce s aktuálním profile a entries │
│ ↓                                                               │
│ calculateTotalDays(profile)                                     │
│ calculateCalorieInfo(profile, currentWeight)                    │
│ calculateProjection(profile, entries)                           │
│ getIdealWeightForDate(profile, date)                            │
│ ↓                                                               │
│ Při změně profile nebo entries se vše přepočítá automaticky     │
└─────────────────────────────────────────────────────────────────┘
```

### Komponenty - Kde se používá `targetWeight`

| Komponenta | Použití targetWeight | Dopad změny |
|------------|---------------------|-------------|
| `Dashboard.tsx` (řádky 197-224) | Stats karty: "Cíl: {targetWeight} kg" | Zobrazí novou hodnotu |
| `WeightChart.tsx` | Reference line na grafu | Změní pozici cílové čáry |
| `WeightTable.tsx` | Porovnání s ideální váhou | Přepočítá ideální váhu pro každý den |
| `ProgressSection.tsx` (celý soubor) | Progress bar, remaining, projekce | Přepočítá všechny metriky |
| `AIScenarios.tsx` | Predikce dosažení cíle | Přepočítá predikce |

---

## 🎯 FEATURE #1: EDITACE VÁHOVÉHO CÍLE

### Požadavky

**Funkční:**
- Uživatel může změnit `targetWeight` kdykoliv po onboardingu
- Při změně se:
  - Aktualizuje profil v databázi
  - Přegenerují se `DailyEntry` záznamy (nový rozsah dní)
  - Zachovají se všechny existující váhové záznamy
  - Automaticky přepočítají všechny odvozené hodnoty
- UI: Tlačítko "Upravit cíl" u karty "Cíl" nebo v nastavení

**Nefunkční:**
- Validace: `newTarget < currentWeight` (nelze zvýšit cíl nad aktuální váhu)
- UX: Potvrzovací dialog před změnou (protože ovlivňuje celý plán)
- Performance: Změna musí být rychlá (< 500ms)

### Technický Návrh

#### Nový API Endpoint: PATCH `/api/profile/target`

**Důvod:** Specializovaný endpoint pro změnu cíle s business logikou

```typescript
// src/app/api/profile/target/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { calculateTotalDays, generateDateRange, getFilledEntries } from "@/lib/calculations";

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  const { newTargetWeight } = await req.json();

  // 1. Validace
  if (typeof newTargetWeight !== "number" || newTargetWeight <= 0) {
    return NextResponse.json({ error: "Invalid target weight" }, { status: 400 });
  }

  // 2. Načíst profil
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // 3. Validace: cíl musí být < startWeight
  if (newTargetWeight >= profile.startWeight) {
    return NextResponse.json({
      error: "Target weight must be less than start weight"
    }, { status: 400 });
  }

  // 4. Načíst existující entries
  const existingEntries = await prisma.dailyEntry.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" },
  });

  // 5. Vytvořit nový profil objekt s novým cílem
  const updatedProfile = {
    ...profile,
    targetWeight: newTargetWeight,
  };

  // 6. Vypočítat nový rozsah dní
  const newTotalDays = calculateTotalDays({
    ...profile,
    targetWeight: newTargetWeight,
    startDate: profile.startDate,
    startWeight: profile.startWeight,
  });

  const newDates = generateDateRange(profile.startDate, newTotalDays);

  // 7. Vytvořit mapu existujících vah
  const existingWeightsMap = new Map(
    existingEntries.map((e) => [e.date, { weight: e.weight, note: e.note }])
  );

  // 8. Vygenerovat nové entries se zachováním existujících vah
  const newEntries = newDates.map((date) => ({
    date,
    weight: existingWeightsMap.get(date)?.weight ?? null,
    note: existingWeightsMap.get(date)?.note ?? null,
  }));

  // 9. Atomická transakce: update profilu + smazání starých entries + vytvoření nových
  await prisma.$transaction(async (tx) => {
    // Update profilu
    await tx.profile.update({
      where: { userId: user.id },
      data: { targetWeight: newTargetWeight },
    });

    // Smazat všechny staré entries
    await tx.dailyEntry.deleteMany({
      where: { userId: user.id },
    });

    // Vytvořit nové entries
    await tx.dailyEntry.createMany({
      data: newEntries.map((e) => ({
        userId: user.id,
        date: e.date,
        weight: e.weight,
        note: e.note,
      })),
    });
  });

  return NextResponse.json({ success: true });
}
```

#### Nová Client Funkce: `updateTargetWeight`

```typescript
// Přidat do src/lib/storage.ts
export async function updateTargetWeight(newTargetWeight: number): Promise<void> {
  const res = await fetch("/api/profile/target", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newTargetWeight }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update target weight");
  }
}
```

#### Nová Komponenta: `EditTargetModal.tsx`

```typescript
// src/components/EditTargetModal.tsx
"use client";

import { useState } from "react";
import { UserProfile } from "@/types";

interface Props {
  profile: UserProfile;
  currentWeight: number;
  onConfirm: (newTarget: number) => Promise<void>;
  onClose: () => void;
}

export default function EditTargetModal({ profile, currentWeight, onConfirm, onClose }: Props) {
  const [newTarget, setNewTarget] = useState(profile.targetWeight.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const targetNum = parseFloat(newTarget);

    // Validace
    if (isNaN(targetNum) || targetNum <= 0) {
      setError("Zadejte platnou váhu");
      return;
    }

    if (targetNum >= profile.startWeight) {
      setError(`Cíl musí být nižší než počáteční váha (${profile.startWeight} kg)`);
      return;
    }

    if (targetNum >= currentWeight) {
      setError(`Cíl musí být nižší než aktuální váha (${currentWeight.toFixed(1)} kg)`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(targetNum);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setLoading(false);
    }
  };

  const oldDays = Math.ceil((profile.startWeight - profile.targetWeight) * 7700 / 500);
  const newDays = Math.ceil((profile.startWeight - parseFloat(newTarget || "0")) * 7700 / 500);
  const daysDiff = newDays - oldDays;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass p-6 max-w-md w-full mx-4 animate-scale-in">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">Upravit cílovou váhu</h3>

        <div className="space-y-4">
          {/* Současný cíl */}
          <div className="bg-gray-800/30 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Současný cíl</div>
            <div className="text-2xl font-bold text-amber-400">{profile.targetWeight} kg</div>
            <div className="text-xs text-gray-500 mt-1">{oldDays} dní celkem</div>
          </div>

          {/* Input nového cíle */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nový cíl</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={newTarget}
                onChange={(e) => {
                  setNewTarget(e.target.value);
                  setError(null);
                }}
                className="input-base pr-12"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">kg</span>
            </div>
          </div>

          {/* Preview změny */}
          {parseFloat(newTarget) > 0 && parseFloat(newTarget) < profile.startWeight && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Náhled změny:</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Nový celkový plán:</span>
                <span className="font-semibold text-emerald-400">{newDays} dní</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-300">Rozdíl:</span>
                <span className={`font-semibold ${daysDiff > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {daysDiff > 0 ? "+" : ""}{daysDiff} dní
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-300">
            ⚠️ Změnou cíle se přepočítá celý plán. Vaše váhové záznamy zůstanou zachovány.
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !!error}
            className="btn-primary"
          >
            {loading ? "Ukládám..." : "Potvrdit změnu"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Úprava Dashboard.tsx - Přidání tlačítka "Upravit cíl"

```typescript
// V Dashboard.tsx přidat:
import { updateTargetWeight } from "@/lib/storage";
import { loadState } from "@/lib/storage";
import EditTargetModal from "./EditTargetModal";

// Přidat state:
const [showEditTarget, setShowEditTarget] = useState(false);

// Přidat handler:
const handleUpdateTarget = useCallback(async (newTarget: number) => {
  await updateTargetWeight(newTarget);

  // Reload dat z API
  const state = await loadState();
  if (state.profile) {
    // Update lokální state (musíme dostat setProfile z props)
    // NEBO reload celé stránky
    window.location.reload();
  }
}, []);

// V JSX u karty "Cíl" (řádek 202-205):
<div className="stat-card glass-sm p-3 sm:p-4 relative group">
  <span className="stat-label">Cíl</span>
  <span className="stat-value text-base sm:text-lg text-amber-400">{profile.targetWeight} kg</span>

  {/* Nové tlačítko */}
  <button
    onClick={() => setShowEditTarget(true)}
    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-700/50 rounded-lg"
    title="Upravit cíl"
  >
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  </button>
</div>

// Na konci komponenty před closing div:
{showEditTarget && (
  <EditTargetModal
    profile={profile}
    currentWeight={latestWeight}
    onConfirm={handleUpdateTarget}
    onClose={() => setShowEditTarget(false)}
  />
)}
```

#### ALTERNATIVA: Úprava HomeClient.tsx místo reload

```typescript
// Lepší řešení - update state bez reload

// V HomeClient.tsx přidat:
const handleUpdateProfile = (newProfile: UserProfile, newEntries: DailyEntry[]) => {
  setProfile(newProfile);
  setEntries(newEntries);
};

// Předat do Dashboard:
<Dashboard
  profile={profile}
  entries={entries}
  setEntries={setEntries}
  onReset={handleReset}
  onProfileUpdate={handleUpdateProfile}  // ✅ NOVÉ
/>

// V Dashboard.tsx:
interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
  setEntries: (entries: DailyEntry[]) => void;
  onReset: () => void;
  onProfileUpdate: (profile: UserProfile, entries: DailyEntry[]) => void;  // ✅ NOVÉ
}

const handleUpdateTarget = useCallback(async (newTarget: number) => {
  await updateTargetWeight(newTarget);

  // Reload fresh dat
  const state = await loadState();
  if (state.profile && state.entries) {
    onProfileUpdate(state.profile, state.entries);  // ✅ Smooth update bez reload
  }
}, [onProfileUpdate]);
```

### Testovací Scénáře

1. **Snížení cíle** (např. 75 kg → 70 kg)
   - Počet dní se zvýší
   - Ideální křivka se změní
   - Progress % klesne (méně hotovo)
   - Všechny váhy zachovány

2. **Zvýšení cíle** (např. 75 kg → 78 kg)
   - Počet dní se sníží
   - Ideální křivka se změní
   - Progress % vzroste (více hotovo)
   - Váhy mimo nový rozsah se smažou

3. **Edge case: Cíl = aktuální váha**
   - Validace zamítne (cíl musí být < aktuální)

4. **Edge case: Cíl > startWeight**
   - Validace zamítne (nesplňuje základní podmínku hubnutí)

---

## 🎯 FEATURE #2: PRVNÍ DEN S AUTOMATICKOU VÁHOU

### Požadavky

**Funkční:**
- Při dokončení onboarding formuláře se první záznam (`startDate`) automaticky vyplní hodnotou `startWeight`
- Uživatel nemusí ručně vyplňovat první den
- První den bude readonly (nelze upravit? nebo lze? - rozhodnutí potřebné)

**Nefunkční:**
- Zpětná kompatibilita: Pokud profil již existuje, neměnit nic
- Jednoduchá implementace

### Technický Návrh

#### VARIANTA A: Úprava `generateInitialEntries()`

```typescript
// V src/lib/calculations.ts
export function generateInitialEntries(profile: UserProfile): DailyEntry[] {
  const totalDays = calculateTotalDays(profile);
  const dates = generateDateRange(profile.startDate, totalDays);

  return dates.map((date, index) => ({
    date,
    weight: index === 0 ? profile.startWeight : null,  // ✅ První den = startWeight
  }));
}
```

**Výhody:**
- Minimální změna (1 řádek)
- Automaticky se aplikuje při každém generování

**Nevýhody:**
- Při změně targetWeight se první den přepíše (ale to je OK, je to startWeight)

#### VARIANTA B: Úprava v `HomeClient.tsx` po generování

```typescript
// V HomeClient.tsx handleOnboardingComplete
const handleOnboardingComplete = async (newProfile: UserProfile) => {
  const initialEntries = generateInitialEntries(newProfile);

  // ✅ Nastavit první den
  if (initialEntries.length > 0) {
    initialEntries[0].weight = newProfile.startWeight;
  }

  setProfile(newProfile);
  setEntries(initialEntries);
  await saveProfile(newProfile);
  await saveEntries(initialEntries);
};
```

**Výhody:**
- Explicitní logika
- Lepší kontrola

**Nevýhody:**
- Duplicita (musí se opakovat i v Dashboard při update targetu)

#### DOPORUČENÍ: Varianta A

Použít Variantu A, protože:
- Je konzistentní napříč celou aplikací
- Jednodušší na údržbu
- První den VŽDY odpovídá `startWeight` (což dává smysl)

### Implementace (Finální)

```typescript
// src/lib/calculations.ts - upravit funkci generateInitialEntries

export function generateInitialEntries(profile: UserProfile): DailyEntry[] {
  const totalDays = calculateTotalDays(profile);
  const dates = generateDateRange(profile.startDate, totalDays);

  return dates.map((date, index) => ({
    date,
    // První den (index 0) = startWeight, ostatní null
    weight: index === 0 ? profile.startWeight : null,
    note: index === 0 ? "Výchozí váha" : undefined,  // 🎁 BONUS: Poznámka
  }));
}
```

### Testovací Scénáře

1. **Nový uživatel**
   - Vyplní onboarding
   - První den má váhu = startWeight
   - Ostatní dny jsou prázdné

2. **Změna targetWeight**
   - První den zůstane = startWeight
   - Graf zobrazí bod na startDate

3. **Edge case: Co když uživatel smaže první den?**
   - WeightTable by neměla umožnit smazat (nebo nastavit na null) první den
   - Přidat validaci v `handleUpdateEntry` v Dashboard

#### Ochrana prvního dne (BONUS)

```typescript
// V Dashboard.tsx - handleUpdateEntry
const handleUpdateEntry = useCallback(
  (date: string, weight: number | null) => {
    // ⭐ OCHRANA: Nelze smazat první den
    if (date === profile.startDate && weight === null) {
      alert("První den (výchozí váha) nelze smazat.");
      return;
    }

    // ... zbytek logiky
  },
  [entries, setEntries, profile.startWeight, profile.startDate]
);
```

---

## 🎯 FEATURE #3: KARTA S TÝDENNÍMI PRŮMĚRY

### Požadavky

**Funkční:**
- Nová karta v dashboardu
- Zobrazuje:
  - **Aktuální týdenní průměr** - průměr z posledních 7 dní (s vyplněnou váhou)
  - **Historické týdenní průměry** - průměry z předchozích týdnů
- Formát: "Týden 1: 90.5 kg", "Týden 2: 89.3 kg", ...
- Vizualizace: Zvýraznit aktuální týden, zobrazit trend (↓ pokles, ↑ nárůst)

**Nefunkční:**
- Minimálně 7 záznamů pro zobrazení
- Responsive design (mobile + desktop)
- Konzistentní s `WeeklyChart` komponentou

### Technický Návrh

#### Nová Funkce: `calculateWeeklyAverages()`

```typescript
// Přidat do src/lib/calculations.ts

export interface WeeklyAverage {
  weekNumber: number;           // 1, 2, 3, ...
  label: string;                // "Týden 1", "Týden 2", ...
  startDate: string;            // ISO string
  endDate: string;              // ISO string
  averageWeight: number;        // Průměrná váha v kg
  entryCount: number;           // Počet záznamů v tomto týdnu
  trend: "down" | "up" | "stable" | null;  // Trend oproti předchozímu týdnu
  changeFromPrevious: number | null;  // Rozdíl oproti předchozímu týdnu
}

/**
 * Vypočítá týdenní průměry vah
 * @param entries - Všechny daily entries (seřazené podle data)
 * @param startDate - Datum začátku sledování (z profilu)
 * @returns Array týdenních průměrů, seřazených od nejstaršího
 */
export function calculateWeeklyAverages(
  entries: DailyEntry[],
  startDate: string
): WeeklyAverage[] {
  const filled = getFilledEntries(entries);

  if (filled.length < 7) {
    return [];  // Potřebujeme alespoň 7 záznamů
  }

  const startDateTime = new Date(startDate).getTime();
  const weeks: WeeklyAverage[] = [];

  // Seskupit entries podle týdnů
  const weekGroups = new Map<number, DailyEntry[]>();

  for (const entry of filled) {
    const entryTime = new Date(entry.date).getTime();
    const daysSinceStart = Math.floor((entryTime - startDateTime) / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(daysSinceStart / 7);

    if (!weekGroups.has(weekNum)) {
      weekGroups.set(weekNum, []);
    }
    weekGroups.get(weekNum)!.push(entry);
  }

  // Vypočítat průměry pro každý týden
  const sortedWeekNums = Array.from(weekGroups.keys()).sort((a, b) => a - b);

  for (let i = 0; i < sortedWeekNums.length; i++) {
    const weekNum = sortedWeekNums[i];
    const weekEntries = weekGroups.get(weekNum)!;

    // Vypočítat průměr
    const sum = weekEntries.reduce((acc, e) => acc + e.weight!, 0);
    const average = sum / weekEntries.length;

    // Datum začátku a konce týdne
    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(weekStartDate.getDate() + weekNum * 7);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    // Trend oproti předchozímu týdnu
    let trend: "down" | "up" | "stable" | null = null;
    let changeFromPrevious: number | null = null;

    if (i > 0) {
      const prevWeek = weeks[i - 1];
      const diff = average - prevWeek.averageWeight;
      changeFromPrevious = Math.round(diff * 100) / 100;

      if (Math.abs(diff) < 0.1) {
        trend = "stable";
      } else if (diff < 0) {
        trend = "down";
      } else {
        trend = "up";
      }
    }

    weeks.push({
      weekNumber: weekNum + 1,  // 1-indexed
      label: `Týden ${weekNum + 1}`,
      startDate: weekStartDate.toISOString().split("T")[0],
      endDate: weekEndDate.toISOString().split("T")[0],
      averageWeight: Math.round(average * 100) / 100,
      entryCount: weekEntries.length,
      trend,
      changeFromPrevious,
    });
  }

  return weeks;
}

/**
 * Získá aktuální týdenní průměr (poslední dokončený týden)
 */
export function getCurrentWeeklyAverage(
  entries: DailyEntry[],
  startDate: string
): WeeklyAverage | null {
  const weeks = calculateWeeklyAverages(entries, startDate);
  return weeks.length > 0 ? weeks[weeks.length - 1] : null;
}
```

#### Nová Komponenta: `WeeklyAveragesCard.tsx`

```typescript
// src/components/WeeklyAveragesCard.tsx
"use client";

import { UserProfile, DailyEntry } from "@/types";
import { calculateWeeklyAverages, formatDate } from "@/lib/calculations";

interface Props {
  profile: UserProfile;
  entries: DailyEntry[];
}

export default function WeeklyAveragesCard({ profile, entries }: Props) {
  const weeks = calculateWeeklyAverages(entries, profile.startDate);

  if (weeks.length === 0) {
    return null;  // Nezobrazovat, pokud není dostatek dat
  }

  const currentWeek = weeks[weeks.length - 1];
  const previousWeeks = weeks.slice(0, -1).reverse();  // Nejnovější první

  const getTrendIcon = (trend: "down" | "up" | "stable" | null) => {
    if (trend === "down") return "↓";
    if (trend === "up") return "↑";
    if (trend === "stable") return "→";
    return "";
  };

  const getTrendColor = (trend: "down" | "up" | "stable" | null) => {
    if (trend === "down") return "text-emerald-400";  // Good (losing weight)
    if (trend === "up") return "text-red-400";        // Bad (gaining weight)
    if (trend === "stable") return "text-gray-400";
    return "text-gray-400";
  };

  return (
    <div className="glass p-4 sm:p-6 animate-slide-up">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-100">Týdenní průměry</h3>
        <p className="text-xs sm:text-sm text-gray-500">Průměrná váha po týdnech</p>
      </div>

      {/* Aktuální týden - zvýrazněný */}
      <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-400 font-medium uppercase tracking-wider mb-1">
              Aktuální týden
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {currentWeek.averageWeight} kg
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {currentWeek.label} ({formatDate(currentWeek.startDate)} - {formatDate(currentWeek.endDate)})
            </div>
            <div className="text-xs text-gray-500">
              {currentWeek.entryCount} {currentWeek.entryCount === 1 ? "záznam" : currentWeek.entryCount < 5 ? "záznamy" : "záznamů"}
            </div>
          </div>

          {currentWeek.changeFromPrevious !== null && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${getTrendColor(currentWeek.trend)}`}>
                {getTrendIcon(currentWeek.trend)}
              </div>
              <div className={`text-sm font-semibold ${getTrendColor(currentWeek.trend)}`}>
                {currentWeek.changeFromPrevious > 0 ? "+" : ""}
                {currentWeek.changeFromPrevious} kg
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Předchozí týdny - kompaktní seznam */}
      {previousWeeks.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Historie
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {previousWeeks.map((week) => (
              <div
                key={week.weekNumber}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-300">{week.label}</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(week.startDate)} - {formatDate(week.endDate)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-200">
                      {week.averageWeight} kg
                    </div>
                    {week.changeFromPrevious !== null && (
                      <div className={`text-xs ${getTrendColor(week.trend)}`}>
                        {getTrendIcon(week.trend)} {week.changeFromPrevious > 0 ? "+" : ""}
                        {week.changeFromPrevious} kg
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Custom Scrollbar Styling (BONUS)

```css
/* Přidat do src/globals.css */

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

/* Firefox */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}
```

#### Integrace do Dashboard.tsx

```typescript
// V Dashboard.tsx přidat import:
import WeeklyAveragesCard from "./WeeklyAveragesCard";

// V JSX - přidat do pravé kolony (ProgressSection):
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Left: Charts */}
  <div className="lg:col-span-2 space-y-6">
    <WeightChart profile={profile} entries={entries} />
    <WeeklyChart entries={entries} />
    <WeightTable
      profile={profile}
      entries={entries}
      onUpdateEntry={handleUpdateEntry}
    />
  </div>

  {/* Right: Progress & Stats */}
  <div className="lg:col-span-1 space-y-6">  {/* ✅ změna: space-y-6 místo jedné komponenty */}
    <ProgressSection profile={profile} entries={entries} />
    <WeeklyAveragesCard profile={profile} entries={entries} />  {/* ✅ NOVÉ */}
  </div>
</div>
```

### Testovací Scénáře

1. **Méně než 7 záznamů**
   - Karta se nezobrazí

2. **Přesně 7 záznamů**
   - Zobrazí se 1 týden (bez předchozích)
   - Žádný trend (není s čím porovnat)

3. **14+ záznamů**
   - Zobrazí se 2+ týdny
   - Aktuální týden zvýrazněn
   - Zobrazí se trendy

4. **Edge case: Neúplný týden**
   - Pokud aktuální týden má jen 3 záznamy, průměr se spočítá z těchto 3
   - Zobrazí se "3 záznamy" jako info

5. **Trend stabilní**
   - Rozdíl < 0.1 kg → "→" a "stable"

---

## 📦 SOUHRN ZMĚN - CHECKLIST PRO IMPLEMENTACI

### Soubory k vytvoření (NOVÉ)

- [ ] `src/app/api/profile/target/route.ts` - API endpoint pro změnu cíle
- [ ] `src/components/EditTargetModal.tsx` - Modal pro editaci cíle
- [ ] `src/components/WeeklyAveragesCard.tsx` - Karta s týdenními průměry

### Soubory k úpravě (EXISTUJÍCÍ)

- [ ] `src/lib/calculations.ts`
  - [ ] Upravit `generateInitialEntries()` - první den = startWeight
  - [ ] Přidat `calculateWeeklyAverages()`
  - [ ] Přidat `getCurrentWeeklyAverage()`

- [ ] `src/lib/storage.ts`
  - [ ] Přidat `updateTargetWeight()`

- [ ] `src/components/Dashboard.tsx`
  - [ ] Přidat state `showEditTarget`
  - [ ] Přidat handler `handleUpdateTarget`
  - [ ] Upravit kartu "Cíl" - přidat tlačítko upravit
  - [ ] Přidat `<EditTargetModal>` do JSX
  - [ ] Přidat ochranu prvního dne v `handleUpdateEntry`
  - [ ] Přidat `<WeeklyAveragesCard>` do layoutu

- [ ] `src/components/HomeClient.tsx`
  - [ ] Přidat `handleUpdateProfile()`
  - [ ] Předat `onProfileUpdate` do Dashboard

- [ ] `src/globals.css`
  - [ ] Přidat `.custom-scrollbar` styles

### Databázové migrace

- [ ] **ŽÁDNÉ** - současné schema plně podporuje všechny funkce

---

## 🧪 TESTOVACÍ PLÁN

### Manuální Testy

#### Feature #1: Editace cíle

1. [ ] Kliknutí na "Upravit cíl" otevře modal
2. [ ] Validace: cíl >= startWeight → error
3. [ ] Validace: cíl >= currentWeight → error
4. [ ] Náhled: zobrazí se nový počet dní a rozdíl
5. [ ] Potvrzení: data se uloží do DB
6. [ ] UI update: všechny karty/grafy se přepočítají
7. [ ] Entries: existující váhy jsou zachovány
8. [ ] Entries: rozsah dní se změní (více/méně dní)

#### Feature #2: První den

1. [ ] Nový uživatel: první den má váhu = startWeight
2. [ ] Graf: první bod je zobrazen správně
3. [ ] Tabulka: první den má hodnotu (ne null)
4. [ ] První den nelze smazat (nastavit na null)

#### Feature #3: Týdenní průměry

1. [ ] < 7 záznamů: karta se nezobrazí
2. [ ] 7+ záznamů: zobrazí se aktuální týden
3. [ ] 14+ záznamů: zobrazí se historie
4. [ ] Trendy: ↓ pro pokles, ↑ pro nárůst, → pro stabilitu
5. [ ] Scrollbar: funguje pro dlouhou historii
6. [ ] Responsive: správně se zobrazí na mobilu

### Automatické Testy (Volitelné)

```typescript
// src/lib/calculations.test.ts (příklad)
import { calculateWeeklyAverages } from "./calculations";

describe("calculateWeeklyAverages", () => {
  it("returns empty array for less than 7 entries", () => {
    const entries = [
      { date: "2026-01-01", weight: 90 },
      { date: "2026-01-02", weight: 89.8 },
    ];
    expect(calculateWeeklyAverages(entries, "2026-01-01")).toEqual([]);
  });

  it("calculates weekly averages correctly", () => {
    const entries = [];
    for (let i = 0; i < 14; i++) {
      entries.push({
        date: `2026-01-${String(i + 1).padStart(2, "0")}`,
        weight: 90 - i * 0.1,
      });
    }
    const weeks = calculateWeeklyAverages(entries, "2026-01-01");
    expect(weeks).toHaveLength(2);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[1].weekNumber).toBe(2);
  });

  it("calculates trend correctly", () => {
    // ... test pro trendy
  });
});
```

---

## 🚀 IMPLEMENTAČNÍ POSTUP (STEP-BY-STEP)

### Fáze 1: Feature #2 (Nejjednodušší - warmup)

**Čas: 15 minut**

1. [ ] Otevřít `src/lib/calculations.ts`
2. [ ] Najít funkci `generateInitialEntries`
3. [ ] Upravit: první entry má `weight: profile.startWeight`
4. [ ] Testovat: vytvořit nový profil, zkontrolovat první den

### Fáze 2: Feature #3 (Střední - samostatný modul)

**Čas: 1-2 hodiny**

1. [ ] Přidat funkce do `src/lib/calculations.ts`:
   - [ ] `calculateWeeklyAverages()`
   - [ ] `getCurrentWeeklyAverage()`
2. [ ] Vytvořit `src/components/WeeklyAveragesCard.tsx`
3. [ ] Přidat custom scrollbar do `src/globals.css`
4. [ ] Integrovat do `Dashboard.tsx` (import + JSX)
5. [ ] Testovat s různým počtem záznamů

### Fáze 3: Feature #1 (Nejsložitější - více součástí)

**Čas: 2-3 hodiny**

**Krok 1: API Endpoint**
1. [ ] Vytvořit složku `src/app/api/profile/target/`
2. [ ] Vytvořit `route.ts` s PATCH handlerem
3. [ ] Implementovat validaci, transakci, logiku
4. [ ] Testovat curl/Postman

**Krok 2: Client Funkce**
1. [ ] Přidat `updateTargetWeight()` do `src/lib/storage.ts`
2. [ ] Testovat volání API

**Krok 3: UI Modal**
1. [ ] Vytvořit `src/components/EditTargetModal.tsx`
2. [ ] Implementovat form, validaci, preview
3. [ ] Testovat standalone

**Krok 4: Integrace**
1. [ ] Upravit `HomeClient.tsx` - přidat `handleUpdateProfile`
2. [ ] Upravit `Dashboard.tsx`:
   - [ ] Import modal
   - [ ] State `showEditTarget`
   - [ ] Handler `handleUpdateTarget`
   - [ ] Tlačítko u karty "Cíl"
   - [ ] Modal v JSX
3. [ ] Testovat celý flow

**Krok 5: Ochrana prvního dne (BONUS)**
1. [ ] Upravit `handleUpdateEntry` v Dashboard
2. [ ] Přidat validaci: nelze smazat první den

### Fáze 4: Finální Testování

**Čas: 1 hodina**

1. [ ] Projít všechny testovací scénáře
2. [ ] Edge cases
3. [ ] Responsive design (mobile + desktop)
4. [ ] Dark/Light theme
5. [ ] Performance (změna cíle < 500ms)

---

## 🎨 UX/UI POZNÁMKY

### Vizuální Konzistence

- Všechny modaly používají stejný style: `glass`, `animate-scale-in`
- Tlačítka: `btn-primary`, `btn-secondary`
- Barvy:
  - Emerald = pozitivní (pokles váhy, progress)
  - Red = negativní (nárůst váhy)
  - Amber = cíl, warning
  - Indigo = plán, ideál
  - Gray = neutrální

### Animace

- Modal: `animate-fade-in` (background) + `animate-scale-in` (content)
- Karty: `animate-slide-up` se staggered delay
- Hover effects: `transition-all duration-200`

### Mobile-First

- Všechny nové komponenty musí být responsive
- Breakpoints: `sm:`, `md:`, `lg:`
- Touch-friendly: min. 44x44px clickable area

### Accessibility (BONUS)

- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus states (ring)
- [ ] ARIA labels pro screen readers
- [ ] Color contrast > 4.5:1

---

## 🐛 EDGE CASES & RIZIKÁ

### Edge Case #1: Změna cíle během dne kdy je nové měření

**Scénář:**
1. Uživatel má cíl 75 kg, plán 100 dní
2. Den 50: váží 82 kg
3. Změní cíl na 70 kg → plán se prodlouží na 150 dní
4. Den 51-100: již má vyplněno váhy

**Řešení:**
- ✅ API endpoint zachovává všechny existující váhy
- ✅ Jen rozšíří rozsah dní (101-150 budou null)

### Edge Case #2: Změna cíle zkrátí plán pod aktuální den

**Scénář:**
1. Uživatel má cíl 75 kg, plán 100 dní
2. Den 80: váží 76 kg
3. Změní cíl na 77 kg → plán se zkrátí na 70 dní

**Problém:**
- Den 80 je mimo nový rozsah (1-70)

**Řešení:**
- ✅ Validace: `newTarget < currentWeight` zamezí tomuto
- Alternativně: Automaticky prodloužit plán pokud `currentDay > newTotalDays`

### Edge Case #3: První den již má jinou váhu

**Scénář:**
1. Uživatel vytvořil profil (první den = startWeight = 90 kg)
2. První den ručně změnil na 89 kg
3. Změní cíl → `generateInitialEntries` přepíše na 90 kg

**Řešení:**
- 🤔 **Rozhodnutí potřebné:**
  - **Varianta A:** První den VŽDY = startWeight (přepíše uživatelský vstup)
  - **Varianta B:** První den = existující váha pokud existuje

**Doporučení:** Varianta A - první den je definice "výchozího stavu", nemá smysl ho měnit

### Riziko #1: Race condition při update targetu

**Scénář:**
- Uživatel dvakrát rychle klikne "Potvrdit změnu"

**Řešení:**
- ✅ `loading` state v modalu
- ✅ `disabled` tlačítko během ukládání

### Riziko #2: Velký rozsah dat (např. 1000+ dní)

**Scénář:**
- Uživatel má startWeight 150 kg, target 70 kg → 800+ dní

**Řešení:**
- ✅ Batch upsert v transakci je efektivní
- ✅ Frontend: Virtualizace tabulky (WeightTable již má pagination)

---

## 📊 MONITORING & ANALYTICS (BONUS)

### Metriky k sledování

1. **Změna cíle**
   - Počet změn na uživatele
   - Průměrná změna (kg)
   - Směr změny (zvýšení vs. snížení)

2. **První den**
   - % uživatelů, kteří upravili první den (pokud povolíme)

3. **Týdenní průměry**
   - Viditelnost karty (% uživatelů s dostatečnými daty)
   - Scroll depth (jestli uživatelé prohlíží historii)

### Implementace (Volitelné)

```typescript
// src/lib/analytics.ts
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, properties);
  }
}

// V EditTargetModal po úspěšné změně:
trackEvent("target_weight_updated", {
  old_target: profile.targetWeight,
  new_target: targetNum,
  change: targetNum - profile.targetWeight,
});
```

---

## 🔐 BEZPEČNOST

### Validace na API úrovni

- ✅ Autentizace: `requireUser()` na všech endpointech
- ✅ Validace vstupů: `typeof`, range checks
- ✅ SQL Injection: ✅ Prisma používá parametrizované queries
- ✅ XSS: ✅ React automaticky escapuje

### Rate Limiting (BONUS)

```typescript
// middleware.ts - přidat rate limit pro /api/profile/target
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),  // Max 5 změn cíle za hodinu
});

// V route.ts:
const { success } = await ratelimit.limit(user.id);
if (!success) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

---

## 📝 DOKUMENTACE PRO UŽIVATELE (README Update)

### Nové Features sekce

```markdown
## 🎯 Funkce

### Editace váhového cíle
Změňte svůj cílovou váhu kdykoliv! Klikněte na ikonu u karty "Cíl" v dashboardu.
- Celý plán se automaticky přepočítá
- Vaše váhové záznamy zůstanou zachovány
- Grafy a statistiky se aktualizují okamžitě

### Automatická první váha
Při vytvoření profilu se váš první den automaticky vyplní výchozí váhou.
Už nemusíte vyplňovat první záznam ručně!

### Týdenní průměry
Nová karta zobrazuje váš průměr po týdnech:
- 📊 Aktuální týdenní průměr - zvýrazněný
- 📈 Historické průměry - trendy ↓↑→
- 🔍 Přehledná historie všech týdnů
```

---

## ✅ DEFINITION OF DONE

Feature je hotové, když:

- [ ] Veškerý kód je napsán podle této specifikace
- [ ] Všechny soubory jsou vytvořeny/upraveny
- [ ] Kód neobsahuje TypeScript errory
- [ ] Aplikace se builduje bez warningů: `npm run build`
- [ ] Všechny manuální testy prošly
- [ ] UI je responzivní (mobile + desktop)
- [ ] Dark/Light theme funguje správně
- [ ] Databáze je konzistentní (transakce fungují)
- [ ] Edge cases jsou ošetřeny
- [ ] Kód je čitelný a má konzistentní styl
- [ ] Git commit s popisnou zprávou

---

## 🎓 ZÁVĚR

Tento dokument obsahuje **kompletní** implementační plán pro všechny tři funkce. Je navržen tak, aby další Claude Opus instance mohla implementovat vše **bez dalších otázek**.

### Priorita implementace:
1. **Feature #2** (15 min) - rychlé vítězství
2. **Feature #3** (1-2 hod) - standalone, bez závislostí
3. **Feature #1** (2-3 hod) - komplexní, ale dobře specifikovaná

**Celkový čas:** 4-6 hodin čisté implementace + 1 hodina testování

---

**Vytvořeno:** 2026-03-01
**Pro:** Claude Opus
**Autor:** Claude Sonnet 4.5 (ULTRA MEGA BIG BRAIN mode)
**Verze:** 1.0.0

---

## 📎 PŘÍLOHY

### A. Rychlá referenční tabulka

| Co | Kde | Akce |
|----|-----|------|
| První den = startWeight | `calculations.ts` | Edit `generateInitialEntries()` |
| Výpočet týdenních průměrů | `calculations.ts` | Add `calculateWeeklyAverages()` |
| Karta týdenních průměrů | `components/` | Create `WeeklyAveragesCard.tsx` |
| API změna cíle | `api/profile/target/` | Create `route.ts` |
| Modal editace cíle | `components/` | Create `EditTargetModal.tsx` |
| Integrace v Dashboard | `Dashboard.tsx` | Add state, handlers, UI |
| Client funkce update | `storage.ts` | Add `updateTargetWeight()` |
| Scrollbar styling | `globals.css` | Add `.custom-scrollbar` |

### B. Použité konstanty

```typescript
const DEFICIT = 500;                 // Kalorický deficit (kcal/den)
const KCAL_PER_KG = 7700;            // Kalorie na 1 kg tuku
const IDEAL_DAILY_LOSS = 0.0649;     // kg/den (= 500/7700)
const MIN_DAILY_CALORIES = 1200;     // Minimální příjem
const MOVING_AVERAGE_WINDOW = 7;     // Okno pro klouzavý průměr
```

### C. Typové definice

```typescript
// Nové typy pro týdenní průměry
export interface WeeklyAverage {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  averageWeight: number;
  entryCount: number;
  trend: "down" | "up" | "stable" | null;
  changeFromPrevious: number | null;
}
```

---

**Good luck, Opus! You got this! 🚀**
