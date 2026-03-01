# WeightFlow - Implementation Guide pro Claude Opus

> Tento guide je pro novou instanci Claude Opus. Obsahuje kompletni kontext aplikace, architekturu a detailni specifikace 7 novych features k implementaci.

## DULEZITE POKYNY PRO INSTANCI

- Aplikace je **v cestine** - vsechny UI texty, labely, hlasky pis cesky
- Pouzivej **glassmorphism dark theme** (tridy `glass`, `glass-sm`, `btn-primary`, `btn-secondary`, `stat-card` z globals.css)
- Drzej konzistentni styl - emerald pro pozitivni, red pro negativni, amber pro cil, indigo pro ideal, cyan pro info
- Deploy na **Zerops** - po zmene pushnout na GitHub (`git add . && git commit -m "popis" && git push`), Zerops automaticky buildne
- Projekt je na `/Users/janblau/www/bimzyy/weight-tracker/`
- GitHub: `https://github.com/blauik/weight-tracker`

---

## ARCHITEKTURA APLIKACE

### Tech Stack
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS 3** s custom glassmorphism komponentami
- **Recharts 2** pro grafy
- **Prisma 5** ORM + PostgreSQL 16
- **NextAuth.js v5** (beta.30) s Credentials providerem + JWT
- **bcryptjs** pro hashovani hesel

### Adresarova struktura
```
weight-tracker/
  prisma/
    schema.prisma          # DB schema - User, Profile, DailyEntry, Account, Session, VerificationToken
  src/
    app/
      layout.tsx           # Root layout - server component, SessionProvider, bg efekty
      page.tsx             # Server component s auth checkem, renderuje HomeClient
      globals.css          # Tailwind + custom tridy (glass, btn-primary, input-base, stat-card, atd.)
      login/page.tsx       # Login formular (client component)
      register/page.tsx    # Registracni formular (client component)
      api/
        auth/
          [...nextauth]/route.ts  # NextAuth route handler - export { GET, POST } = handlers
          register/route.ts       # POST - registrace noveho uzivatele (bcrypt hash)
        state/route.ts            # GET - nacte profil + entries, DELETE - smaze vse
        profile/route.ts          # POST - upsert profilu
        entries/route.ts          # PUT - bulk upsert entries, PATCH - single entry update
    components/
      HomeClient.tsx       # Client wrapper - loadState, onboarding/dashboard routing
      Dashboard.tsx        # Hlavni dashboard - stat cards, charts, table, progress
      OnboardingForm.tsx   # 4-krokovy wizard pro vytvoreni profilu
      WeightChart.tsx      # Hlavni graf vahy (ComposedChart - actual + ideal + projection)
      WeeklyChart.tsx      # Tydeni zmeny (BarChart)
      WeightTable.tsx      # Tabulka dennich zaznamu s inline editaci
      ProgressSection.tsx  # Progress bar, kalorie, projekce, scenare
      SessionProvider.tsx  # Client wrapper pro NextAuth SessionProvider
    lib/
      auth.ts              # NextAuth v5 konfigurace (trustHost, Credentials, JWT, callbacks)
      prisma.ts            # Prisma client singleton
      session.ts           # getCurrentUser() a requireUser() helpery
      storage.ts           # API client - loadState, saveProfile, saveEntries, updateEntry, clearAll
      calculations.ts      # BMR, TDEE, kalorie, projekce, ideal weight, formating, streaks
    types/
      index.ts             # TypeScript typy - UserProfile, DailyEntry, AppState, CalorieInfo, ProjectionData
    middleware.ts          # NextAuth v5 middleware - auth check, redirect logic
  zerops.yml              # Zerops deployment konfigurace
  next.config.js          # Prazdna konfigurace
  tailwind.config.ts      # Custom animace + brand barvy
  package.json            # Dependencies
```

### Datovy model (Prisma)
```
User (id, email, password, name, ...) -- NextAuth
  |-- Profile (name, gender, age, heightCm, startWeight, targetWeight, activityLevel, startDate)
  |-- DailyEntry[] (date, weight, note) -- @@unique([userId, date])
```

### Autentizace flow
1. Middleware (`src/middleware.ts`) chrani vsechny routes krome `/login`, `/register`, `/api/auth/*`
2. `page.tsx` je server component s `auth()` checkem - redirect na `/login` pokud neni prihlaseny
3. API routes pouzivaji `requireUser()` z `session.ts` pro ziskani userId
4. JWT strategie - token obsahuje `id`, `email`, `name`

### UI design system
- **Pozadi**: `bg-gray-950` s blurred gradient orbs (emerald, cyan, violet)
- **Karty**: `.glass` (bg-gray-900/60 backdrop-blur-xl border-gray-800/50 rounded-2xl)
- **Male karty**: `.glass-sm` (bg-gray-900/40 backdrop-blur-md rounded-xl)
- **Inputy**: `.input-base` (bg-gray-800/50 border-gray-700/50 rounded-xl focus:ring-emerald-500)
- **Primary button**: `.btn-primary` (gradient emerald-500 to emerald-600, shadow, hover scale)
- **Secondary button**: `.btn-secondary` (bg-gray-800 hover:bg-gray-700 rounded-xl)
- **Animace**: fade-in, slide-up, slide-in-right, scale-in, progress, pulse-slow, number-tick

### Zerops deployment
- **zerops.yml** s `setup: app` - build + deploy + run konfigurace
- Build: `rm -rf node_modules && npm i && npx prisma generate && NEXTAUTH_SECRET=... npm run build`
- Deploy: `deployFiles: ./` (cely adresar)
- Run: `npx next start -H 0.0.0.0 -p 3000`
- Init: `npx prisma db push --skip-generate --accept-data-loss`
- Env vars: DATABASE_URL (postgresql://${db_user}:${db_password}@db:5432/db), NEXTAUTH_URL, NEXTAUTH_SECRET
- **DULEZITE**: HOSTNAME env var NESMI byt v envVariables (Zerops systemova promenna) - pouzij `-H 0.0.0.0` v start command
- **DULEZITE**: NEXTAUTH_SECRET v buildCommands MUSI byt STEJNY jako v run envVariables

---

## FEATURE 1: TREND LINE (Klouzavy prumer v grafu)

### Co implementovat
Pridat do WeightChart.tsx **7-denni klouzavy prumer** (moving average) jako novou caru v grafu. Trendova cara vyhladi denni vykyvy a ukaze skutecny smer vahy.

### Kde upravit
- `src/components/WeightChart.tsx` - pridat novou Line do ComposedChart
- `src/lib/calculations.ts` - pridat funkci `calculateMovingAverage()`

### Specifikace

#### calculations.ts - nova funkce
```typescript
export function calculateMovingAverage(entries: DailyEntry[], window: number = 7): (number | null)[] {
  // Pro kazdy entry spocitej prumer poslednich `window` vyplnenych zaznamu
  // Vrat pole stejne delky jako entries
  // Prvnich `window-1` zaznamu bude null (neni dost dat)
  // Pouzij jen entries kde weight !== null
  // Algoritmus:
  //   1. Pro kazdy index najdi poslednich `window` non-null weights vcetne aktualniho
  //   2. Pokud jich je min nez `window`, vrat null
  //   3. Jinak vrat prumer zaokrouhleny na 2 desetinna mista
}
```

#### WeightChart.tsx - zmeny
1. Importuj `calculateMovingAverage` z calculations
2. V chartData pridej pole `trend`:
```typescript
const movingAvg = calculateMovingAverage(filled, 7);
const chartData = filled.map((entry, i) => ({
  date: entry.date,
  label: formatDate(entry.date),
  weight: entry.weight,
  ideal: ...,
  trend: movingAvg[i], // novy field
}));
```
3. Pridej novou Line komponentu za existujici lines:
```tsx
<Line
  type="monotone"
  dataKey="trend"
  stroke="#f472b6"          // ruzova (pink-400)
  strokeWidth={2}
  dot={false}
  strokeDasharray="2 2"     // jemne carkovana
  connectNulls
/>
```
4. Updatuj Legend a Tooltip labels - `trend: "7D klouzavy prumer"`
5. Zahrn trend hodnoty do `allWeights` pro spravny Y-axis rozsah

### Vizualni styl
- Barva: `#f472b6` (pink-400) - odlisi se od zelene (actual), indigo (ideal), amber (projection)
- Cara: tenka (2px), jemne carkovana
- Bez tecek (dots)

---

## FEATURE 2: UPLOAD FOTEK POKROKU

### Co implementovat
Umoznit uzivateli nahrat **progress foto** (pred/po) navazane na datum. Fotky se ukladaji do databaze jako Base64 (jednoduche, bez externiho storage). Zobrazit galerii na dashboardu.

### Kde upravit/pridat
- `prisma/schema.prisma` - pridat model ProgressPhoto
- `src/types/index.ts` - pridat ProgressPhoto typ
- `src/app/api/photos/route.ts` - NOVY - CRUD pro fotky
- `src/components/PhotoGallery.tsx` - NOVY - galerie + upload
- `src/components/Dashboard.tsx` - pridat PhotoGallery do layoutu
- `src/lib/storage.ts` - pridat API funkce pro fotky

### Specifikace

#### Prisma schema - novy model
```prisma
model ProgressPhoto {
  id        String   @id @default(cuid())
  userId    String
  date      String   // YYYY-MM-DD
  imageData String   @db.Text  // Base64 encoded image
  note      String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([date])
}
```
- Pridej `progressPhotos ProgressPhoto[]` do modelu User

#### types/index.ts
```typescript
export interface ProgressPhoto {
  id: string;
  date: string;
  imageData: string;  // base64
  note?: string;
}
```

#### API route: src/app/api/photos/route.ts
- **GET** - nacte vsechny fotky uzivatele, serazene dle data
- **POST** - upload nove fotky (body: { date, imageData, note? })
  - Validuj max velikost Base64 stringu (5MB = ~6.6MB base64)
  - Komprimuj obrazek na klientu pred odeslanim (max 1200px sirka)
- **DELETE** - smaze fotku dle id (body: { id })

#### storage.ts - nove funkce
```typescript
export async function loadPhotos(): Promise<ProgressPhoto[]> { ... }
export async function uploadPhoto(date: string, imageData: string, note?: string): Promise<void> { ... }
export async function deletePhoto(id: string): Promise<void> { ... }
```

#### PhotoGallery.tsx komponenta
Struktura:
```
<div class="glass p-6">
  <h3>Fotky pokroku</h3>
  <!-- Upload button -->
  <input type="file" accept="image/*" hidden ref={fileRef} />
  <button onClick={() => fileRef.current?.click()}>Pridat fotku</button>

  <!-- Gallery grid -->
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    {photos.map(photo => (
      <div class="relative group cursor-pointer">
        <img src={photo.imageData} class="rounded-xl aspect-square object-cover" />
        <div class="overlay - datum + note">
          <span>{formatDate(photo.date)}</span>
          <button onClick={delete}>X</button>
        </div>
      </div>
    ))}
  </div>

  <!-- Lightbox modal na kliknuti -->
  {selectedPhoto && <Modal photo={selectedPhoto} />}
</div>
```

Klientska komprese obrazku:
```typescript
function compressImage(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = URL.createObjectURL(file);
  });
}
```

#### Dashboard.tsx
- Pridat do importu: `import PhotoGallery from "./PhotoGallery"`
- Pridat pod WeeklyChart v layoutu:
```tsx
<PhotoGallery />
```
(PhotoGallery si sama nacita data pres useEffect)

### DULEZITE
- Po pridani modelu do schema.prisma spustit `npx prisma db push` lokalne
- Zerops to pushne automaticky pres initCommands

---

## FEATURE 3: RESPONSIVITA (Mobilni vylepeni)

### Co implementovat
Zlepsit mobilni zobrazeni vsech komponent. Hlavne: tabulka (prilis siroka), nav bar (preplneny), stat cards, grafy.

### Kde upravit
- `src/components/Dashboard.tsx` - responsive nav, stat cards
- `src/components/WeightTable.tsx` - horizontalni scroll, compact mode
- `src/components/WeightChart.tsx` - mensi vyska na mobile
- `src/components/WeeklyChart.tsx` - mensi vyska na mobile
- `src/components/ProgressSection.tsx` - compact spacing
- `src/app/globals.css` - pripadne nove utility tridy

### Specifikace

#### Dashboard.tsx - nav bar
Aktualni problem: Quick stats v navu jsou skryte na mobile (`hidden md:flex`), ale tlacitka Odhlasit + Reset jsou tesne.

Zmeny:
- Zabalit nav akce do hamburger menu na mobile (`< md`)
- Pridat mobilni bottom-nav alternativne
- NEBO: zjednodusit - na mobile zobrazit jen logo + aktualni vahu + menu ikonu

```tsx
// Mobile: jen logo + current weight + hamburger
<header className="sticky top-0 z-50 glass ...">
  <div className="flex items-center justify-between">
    {/* Logo - vzdy */}
    <div className="flex items-center gap-2">
      <Logo />
      <span className="text-base font-bold ...">WeightFlow</span>
    </div>

    {/* Current weight - vzdy viditelne */}
    <div className="md:hidden text-center">
      <div className="text-gray-100 font-bold">{latestWeight.toFixed(1)} kg</div>
    </div>

    {/* Desktop: plne stats + buttons (existujici) */}
    <div className="hidden md:flex items-center gap-6">
      {/* ... existujici kod ... */}
    </div>

    {/* Mobile: hamburger menu */}
    <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
      <HamburgerIcon />
    </button>
  </div>

  {/* Mobile dropdown menu */}
  {mobileMenuOpen && (
    <div className="md:hidden border-t border-gray-800/50 py-3 px-4 space-y-2 animate-slide-up">
      <div className="grid grid-cols-3 gap-3 text-center text-sm mb-3">
        <div><span className="text-emerald-400 font-bold">{calorieInfo.dailyTarget}</span><br/><span className="text-xs text-gray-500">kcal/den</span></div>
        <div><span className="text-gray-100 font-bold">{latestWeight.toFixed(1)} kg</span><br/><span className="text-xs text-gray-500">aktualni</span></div>
        <div><span className="text-amber-400 font-bold">{totalDays} dni</span><br/><span className="text-xs text-gray-500">plan</span></div>
      </div>
      <div className="flex gap-2">
        <button onClick={signOut} className="btn-secondary flex-1 text-xs">Odhlasit</button>
        <button onClick={reset} className="btn-secondary flex-1 text-xs">Reset</button>
      </div>
    </div>
  )}
</header>
```

#### WeightTable.tsx - mobile
- Skryt sloupce "Ideal" a "Rozdil" na mobile:
```tsx
<th className="hidden sm:table-cell ...">Ideal</th>
<td className="hidden sm:table-cell ...">...</td>
```
- Zmensit padding: `py-2 px-2 sm:px-3`
- Zmensit font: `text-xs sm:text-sm`

#### WeightChart.tsx + WeeklyChart.tsx
- Dynamicka vyska: `h-56 sm:h-80`
- Mensi margin na mobile: `margin={{ top: 5, right: 5, left: -15, bottom: 5 }}`

#### Stat cards v Dashboard.tsx
Zmena gridu:
```tsx
{/* Aktualne: grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 */}
{/* Nove: */}
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
```
- Zmensit stat-value na mobile: `text-base sm:text-lg`

#### ProgressSection.tsx
- Zmensit padding: `p-4 sm:p-6`
- Compact text: `text-sm sm:text-lg` pro hodnoty
- Scenare: na mobile zobrazit jen 2 (300 a 500) misto 4

---

## FEATURE 4: DARK/LIGHT MODE TOGGLE

### Co implementovat
Pridat prepinac tmaveho/svetleho rezimu. Aktualne je jen dark mode. Pouzit Tailwind `dark:` tridu s localStorage persistenci.

### Kde upravit/pridat
- `tailwind.config.ts` - pridat `darkMode: 'class'`
- `src/app/globals.css` - prepsat vsechny styly pro light/dark
- `src/components/ThemeProvider.tsx` - NOVY - theme context + persistence
- `src/components/ThemeToggle.tsx` - NOVY - toggle tlacitko
- `src/app/layout.tsx` - zabalit do ThemeProvider
- `src/components/Dashboard.tsx` - pridat ThemeToggle do nav

### Specifikace

#### tailwind.config.ts
```typescript
const config: Config = {
  darkMode: 'class',  // PRIDAT
  content: [...],
  theme: { ... }
};
```

#### ThemeProvider.tsx
```typescript
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: "dark", toggleTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Nacti z localStorage pri mount
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else {
      // Default dark
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

#### ThemeToggle.tsx
```tsx
"use client";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="btn-secondary p-2 rounded-xl" title="Prepnout rezim">
      {theme === "dark" ? (
        <svg className="w-4 h-4" ...>/* sun icon */</svg>
      ) : (
        <svg className="w-4 h-4" ...>/* moon icon */</svg>
      )}
    </button>
  );
}
```

#### globals.css - light mode styly
Prepsat `@layer base` a `@layer components` s dark: variantami:

```css
@layer base {
  body {
    @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 antialiased;
  }
  ::selection {
    @apply bg-emerald-500/30;
  }
}

@layer components {
  .glass {
    @apply bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl
    border border-gray-200 dark:border-gray-800/50 rounded-2xl
    shadow-lg shadow-gray-200/50 dark:shadow-none;
  }
  .glass-sm {
    @apply bg-white/60 dark:bg-gray-900/40 backdrop-blur-md
    border border-gray-200 dark:border-gray-800/40 rounded-xl
    shadow-md shadow-gray-200/30 dark:shadow-none;
  }
  .input-base {
    @apply w-full px-4 py-3 bg-gray-100 dark:bg-gray-800/50
    border border-gray-300 dark:border-gray-700/50 rounded-xl
    text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
    transition-all duration-200;
  }
  .stat-card {
    @apply glass-sm p-4 flex flex-col gap-1;
  }
  .stat-label {
    @apply text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 font-medium;
  }
  .stat-value {
    @apply text-2xl font-bold text-gray-900 dark:text-gray-100;
  }
  /* btn-primary zustava stejny (emerald gradient je ok v obou modech) */
  .btn-secondary {
    @apply px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
    text-gray-700 dark:text-gray-300 rounded-xl
    border border-gray-300 dark:border-gray-700/50
    transition-all duration-200;
  }
}

/* Scrollbar light mode */
.dark ::-webkit-scrollbar-thumb {
  @apply bg-gray-700;
}
::-webkit-scrollbar-thumb {
  @apply bg-gray-300;
}

/* Recharts tooltip - bude treba resit pres inline styles dynamicky */
```

#### layout.tsx
```tsx
import ThemeProvider from "@/components/ThemeProvider";

export default async function RootLayout({ children }) {
  return (
    <html lang="cs" className="dark">  {/* default dark */}
      <body>
        <ThemeProvider>
          <SessionProvider session={session}>
            {/* bg orbs - upravit pro light mode */}
            <div className="fixed inset-0 -z-10">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/5 rounded-full blur-3xl" />
              ...
            </div>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### Dashboard.tsx
- Pridat `import ThemeToggle from "./ThemeToggle"`
- Pridat do nav vedle tlacitek:
```tsx
<div className="flex items-center gap-2 sm:gap-3">
  <ThemeToggle />
  <button onClick={signOut} ...>Odhlasit</button>
  ...
</div>
```

#### Recharts barvy
V WeightChart.tsx, WeeklyChart.tsx - Recharts pouziva inline barvy, ne Tailwind. Pro dynamicke barvy:
- Importuj `useTheme` hook
- Nastavuj barvy dynamicky: `stroke={theme === 'dark' ? '#6b7280' : '#d1d5db'}` pro CartesianGrid, axes, atd.
- Tooltip contentStyle dynamicky: `backgroundColor: theme === 'dark' ? '#111827' : '#ffffff'`

### DULEZITE
- Vsechny barvy textu (text-gray-100, text-gray-500, atd.) musi mit dark: varianty
- Login/Register stranky taky musi podporovat light mode
- OnboardingForm taky

---

## FEATURE 5: KONFETTI ANIMACE PRI NOVEM MINIMU

### Co implementovat
Kdyz uzivatel zada novou vahu ktera je **nejnizsi od zacatku sledovani** (novy osobni rekord), spustit konfetti animaci a zobrazit gratulacni zpravu.

### Kde pridat/upravit
- `package.json` - pridat `canvas-confetti` balicek (`npm install canvas-confetti @types/canvas-confetti`)
- `src/components/Dashboard.tsx` - detekce noveho minima + trigger
- `src/components/Confetti.tsx` - NOVY - konfetti wrapper
- `src/components/NewRecordToast.tsx` - NOVY - gratulacni toast

### Specifikace

#### Confetti.tsx
```typescript
"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";

interface Props {
  trigger: boolean;
  onComplete?: () => void;
}

export default function Confetti({ trigger, onComplete }: Props) {
  useEffect(() => {
    if (!trigger) return;

    // Spustit konfetti z obou stran
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f472b6'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f472b6'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
      else onComplete?.();
    };
    frame();
  }, [trigger, onComplete]);

  return null; // Renderuje na canvas-confetti's vlastni canvas
}
```

#### NewRecordToast.tsx
```tsx
"use client";

interface Props {
  show: boolean;
  weight: number;
  previousMin: number;
  onClose: () => void;
}

export default function NewRecordToast({ show, weight, previousMin, onClose }: Props) {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] animate-slide-up">
      <div className="glass p-5 max-w-sm border-emerald-500/30 shadow-lg shadow-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🎉</div>
          <div>
            <h4 className="font-bold text-emerald-400">Novy rekord!</h4>
            <p className="text-sm text-gray-400 mt-1">
              {weight.toFixed(1)} kg - to je o{" "}
              <span className="text-emerald-400 font-semibold">
                {(previousMin - weight).toFixed(1)} kg
              </span>{" "}
              min nez predchozi minimum!
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400">
            <svg className="w-4 h-4" ...>X</svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Dashboard.tsx - integrace
```typescript
const [showConfetti, setShowConfetti] = useState(false);
const [newRecord, setNewRecord] = useState<{ weight: number; previousMin: number } | null>(null);

const handleUpdateEntry = useCallback(
  (date: string, weight: number | null) => {
    if (weight !== null) {
      // Najdi dosavadni minimum (krome aktualniho zaznamu)
      const otherWeights = entries
        .filter(e => e.date !== date && e.weight !== null)
        .map(e => e.weight!);
      const currentMin = otherWeights.length > 0 ? Math.min(...otherWeights) : profile.startWeight;

      if (weight < currentMin) {
        // NOVY REKORD!
        setShowConfetti(true);
        setNewRecord({ weight, previousMin: currentMin });
        setTimeout(() => setShowConfetti(false), 4000);
      }
    }

    const updated = entries.map(e => e.date === date ? { ...e, weight } : e);
    setEntries(updated);
    updateEntry(date, weight);
  },
  [entries, setEntries, profile.startWeight]
);

// V JSX:
return (
  <div>
    <Confetti trigger={showConfetti} />
    <NewRecordToast
      show={!!newRecord}
      weight={newRecord?.weight ?? 0}
      previousMin={newRecord?.previousMin ?? 0}
      onClose={() => setNewRecord(null)}
    />
    {/* ... zbytek dashboardu ... */}
  </div>
);
```

---

## FEATURE 6: AI PREDIKCE (Pokrocila projekce)

### Co implementovat
Vylepsit projekci vahy pomoci **polynomialni regrese** misto jednoduche linearni. Pridat vizualizaci confidence intervalu a scenare "optimisticky/pesimisticky/realisticky".

### Kde upravit
- `src/lib/calculations.ts` - novy predikcni engine
- `src/components/WeightChart.tsx` - confidence band + AI projekce
- `src/components/ProgressSection.tsx` - nove scenare

### Specifikace

#### calculations.ts - novy predikcni system

```typescript
export interface AIPrediction {
  // Denni predikce na dalsich 30 dni
  predictions: Array<{
    date: string;
    optimistic: number;    // rychlejsi hubnuty (horni kvartil rychlosti)
    realistic: number;     // polynomialni fit
    pessimistic: number;   // pomalejsi (dolni kvartil)
  }>;
  // Predpokladane datum dosazeni cile
  estimatedGoalDate: {
    optimistic: string;
    realistic: string;
    pessimistic: string;
  } | null;
  // Kvalita predikce (R-squared)
  confidence: number;    // 0-1
  // Aktualni rychlost (posledni 2 tydny vs celkova)
  recentTrend: number;   // kg/den za poslednich 14 dni
  overallTrend: number;  // kg/den celkove
}

export function calculateAIPrediction(
  profile: UserProfile,
  entries: DailyEntry[]
): AIPrediction | null {
  const filled = getFilledEntries(entries);
  if (filled.length < 5) return null;  // Potrebujeme alespon 5 bodu

  // 1. Polynomialni regrese 2. stupne (quadratic fit)
  //    y = a*x^2 + b*x + c
  //    kde x = pocet dni od startu, y = vaha
  //
  //    Pouzij metodu nejmensich ctvercu:
  //    Sestav matici X = [[x^2, x, 1], ...] a vektor Y = [weights]
  //    Reseni: (X^T * X)^(-1) * X^T * Y
  //
  //    Implementuj 3x3 inverzi matice rucne (bez knihovny)

  // 2. R-squared (koeficient determinace)
  //    R2 = 1 - (SS_res / SS_tot)
  //    kde SS_res = sum((y_actual - y_predicted)^2)
  //        SS_tot = sum((y_actual - y_mean)^2)

  // 3. Recent trend (poslednich 14 dni)
  //    Linearni regrese jen poslednich 14 bodu -> slope

  // 4. Scenare
  //    - realistic: polynomialni fit extrapolovany dopredu
  //    - optimistic: realistic * 1.2 (20% rychlejsi)
  //    - pessimistic: realistic * 0.7 (30% pomalejsi)
  //    - Vsechny ohranicit dole profilem.targetWeight

  // 5. Goal date estimation
  //    Pro kazdy scenar najdi prvni den kde predikce <= targetWeight
}
```

#### 3x3 Matrix inversion helper (pro polynomialni fit)
```typescript
function solveQuadraticFit(
  xs: number[],
  ys: number[]
): { a: number; b: number; c: number } {
  // Metoda nejmensich ctvercu pro y = ax^2 + bx + c
  const n = xs.length;
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0;
  let sy = 0, sxy = 0, sx2y = 0;

  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sx += x; sx2 += x*x; sx3 += x*x*x; sx4 += x*x*x*x;
    sy += y; sxy += x*y; sx2y += x*x*y;
  }

  // Resime soustavu:
  // | sx4 sx3 sx2 | |a|   |sx2y|
  // | sx3 sx2 sx  | |b| = |sxy |
  // | sx2 sx  n   | |c|   |sy  |

  // Cramerovo pravidlo nebo Gauss eliminace
  // ... implementace ...
}
```

#### WeightChart.tsx - AI prediction vizualizace
1. Importuj `calculateAIPrediction`
2. Spocitej predikci: `const aiPrediction = calculateAIPrediction(profile, entries)`
3. Pridej do chartData predikce (za posledni realny zaznam):
```typescript
if (aiPrediction) {
  aiPrediction.predictions.forEach(pred => {
    chartData.push({
      date: pred.date,
      label: formatDate(pred.date),
      weight: undefined,
      ideal: getIdealWeightForDate(profile, pred.date),
      aiRealistic: pred.realistic,
      aiOptimistic: pred.optimistic,
      aiPessimistic: pred.pessimistic,
    });
  });
}
```
4. Pridej Area pro confidence band:
```tsx
{/* Confidence band - oblast mezi optimistickym a pesimistickym */}
<Area
  type="monotone"
  dataKey="aiOptimistic"
  stroke="none"
  fill="none"
/>
<Area
  type="monotone"
  dataKey="aiPessimistic"
  stroke="none"
  fill="#f59e0b"
  fillOpacity={0.1}
/>
{/* Realistic line */}
<Line
  type="monotone"
  dataKey="aiRealistic"
  stroke="#f59e0b"
  strokeWidth={2}
  strokeDasharray="6 3"
  dot={false}
/>
```

#### ProgressSection.tsx - nove scenare
Nahrad sekci "Hypoteticke scenare" za:
```tsx
{aiPrediction && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold text-gray-400 uppercase">AI Predikce</h4>
      <span className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full">
        Presnost: {(aiPrediction.confidence * 100).toFixed(0)}%
      </span>
    </div>

    {/* 3 scenare s datumy */}
    {[
      { key: "optimistic", label: "Optimisticky", color: "text-emerald-400", date: aiPrediction.estimatedGoalDate?.optimistic },
      { key: "realistic", label: "Realisticky", color: "text-amber-400", date: aiPrediction.estimatedGoalDate?.realistic },
      { key: "pessimistic", label: "Pesimisticky", color: "text-red-400", date: aiPrediction.estimatedGoalDate?.pessimistic },
    ].map(scenario => (
      <div key={scenario.key} className="flex justify-between p-3 bg-gray-800/30 rounded-lg">
        <span className={`text-sm font-medium ${scenario.color}`}>{scenario.label}</span>
        <span className="text-sm text-gray-300">
          {scenario.date ? formatDateFull(scenario.date) : "—"}
        </span>
      </div>
    ))}

    {/* Recent vs overall trend */}
    <div className="grid grid-cols-2 gap-3 mt-2">
      <div className="stat-card">
        <span className="stat-label">Trend 14 dni</span>
        <span className="stat-value text-lg">{(-aiPrediction.recentTrend).toFixed(3)} kg/den</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Celkovy trend</span>
        <span className="stat-value text-lg">{(-aiPrediction.overallTrend).toFixed(3)} kg/den</span>
      </div>
    </div>
  </div>
)}
```

---

## FEATURE 7: ZAPOMENUTE HESLO

### Co implementovat
Flow pro reset hesla. Jelikoz nemame email server, pouzijeme **token-based reset** kde admin/uzivatel vidi token v URL. Pro produkcni verzi lze pozdeji napojit email service (Resend, Sendgrid).

Jednodussi pristup: **Secret question** nebo **direct token display** (pro single-user/demo app).

Zvoleny pristup: **Token v URL + zobrazeni na strance** (bez emailu, token se zobrazi uzivatelovi po zadani emailu - pro demo to staci).

### Kde pridat/upravit
- `prisma/schema.prisma` - vyuzit existujici VerificationToken model
- `src/app/api/auth/forgot-password/route.ts` - NOVY
- `src/app/api/auth/reset-password/route.ts` - NOVY
- `src/app/forgot-password/page.tsx` - NOVY
- `src/app/reset-password/page.tsx` - NOVY
- `src/app/login/page.tsx` - pridat link "Zapomeli jste heslo?"
- `src/middleware.ts` - pridat `/forgot-password` a `/reset-password` do vyjimek

### Specifikace

#### API: /api/auth/forgot-password (POST)
```typescript
// Body: { email: string }
// 1. Najdi uzivatele dle emailu
// 2. Pokud neexistuje, vrat success (nechceme leakovat existence emailu)
// 3. Vygeneruj nahodny token (crypto.randomUUID())
// 4. Uloz do VerificationToken s expiraci 1 hodina
// 5. Vrat token v response (v produkcni verzi by se poslal emailem)
// Response: { token: string, resetUrl: string }
```

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email je povinny" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Nevyzrazuj ze email neexistuje - vrat success
    return NextResponse.json({
      message: "Pokud ucet existuje, byl vygenerovan reset link.",
      token: null,
    });
  }

  // Smaz stare tokeny
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Vygeneruj novy token
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hodina

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  return NextResponse.json({
    message: "Reset link vygenerovan",
    token,
    resetUrl,
  });
}
```

#### API: /api/auth/reset-password (POST)
```typescript
// Body: { email: string, token: string, newPassword: string }
// 1. Najdi token v VerificationToken
// 2. Over ze neni expiry
// 3. Najdi uzivatele
// 4. Hashni nove heslo (bcrypt)
// 5. Updatni heslo
// 6. Smaz pouzity token
```

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, token, newPassword } = await req.json();

  if (!email || !token || !newPassword) {
    return NextResponse.json({ error: "Vsechna pole jsou povinna" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Heslo musi mit alespon 8 znaku" }, { status: 400 });
  }

  // Over token
  const verificationToken = await prisma.verificationToken.findFirst({
    where: { identifier: email, token },
  });

  if (!verificationToken) {
    return NextResponse.json({ error: "Neplatny nebo expiry token" }, { status: 400 });
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });
    return NextResponse.json({ error: "Token vyprsel" }, { status: 400 });
  }

  // Updatni heslo
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  // Smaz token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return NextResponse.json({ message: "Heslo uspesne zmeneno" });
}
```

#### forgot-password/page.tsx
```tsx
"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      } else {
        setError("Ucet s timto emailem neexistuje");
      }
    } catch {
      setError("Chyba serveru");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo header - stejny styl jako login */}
        <div className="glass p-8 animate-slide-up">
          {!resetUrl ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-100">Obnoveni hesla</h2>
              <p className="text-sm text-gray-500">Zadejte email sveho uctu</p>

              {error && <div className="p-3 bg-red-500/10 ...">{error}</div>}

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vas@email.cz"
                className="input-base"
                required
              />
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Generuji..." : "Obnovit heslo"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-emerald-400">Reset link vygenerovan!</h2>
              <p className="text-sm text-gray-400">
                Kliknete na odkaz nize pro zmenu hesla:
              </p>
              <a
                href={resetUrl}
                className="block p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/20 break-all"
              >
                {resetUrl}
              </a>
              <p className="text-xs text-gray-600">
                Link je platny 1 hodinu. V budouci verzi bude odeslan emailem.
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-emerald-400 hover:text-emerald-300">
              Zpet na prihlaseni
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### reset-password/page.tsx
```tsx
"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Hesla se neshoduji"); return; }
    if (newPassword.length < 8) { setError("Min 8 znaku"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch { setError("Chyba serveru"); }
    finally { setLoading(false); }
  };

  if (!token || !email) {
    return <div>Neplatny reset link</div>;
  }

  // Form pro nove heslo (stejny styl jako register)
  // Po uspechu zobrazit "Heslo zmeneno! Presmerujeme vas na prihlaseni..."
}
```

#### login/page.tsx - pridat link
Pod formular, pred "Nemate ucet?":
```tsx
<div className="mt-4 text-center">
  <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-400">
    Zapomeli jste heslo?
  </Link>
</div>
```

#### middleware.ts - vyjimky
Updatuj matcher:
```typescript
export const config = {
  matcher: [
    "/((?!api/auth|login|register|forgot-password|reset-password|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
```

---

## PORADI IMPLEMENTACE (DOPORUCENE)

1. **Responsivita** (Feature 3) - zaklad, nerozbije nic
2. **Trend Line** (Feature 1) - jednoducha, lokalizovana zmena
3. **Dark/Light Mode** (Feature 4) - zasahuje hodne souboru ale logicky jednoduche
4. **Konfetti animace** (Feature 5) - zabavne, rychle
5. **AI Predikce** (Feature 6) - slozitejsi matematika
6. **Upload fotek** (Feature 2) - nova DB tabulka + API + komponenta
7. **Zapomenute heslo** (Feature 7) - nove stranky + API + middleware zmena

## PO KAZDE FEATURE

1. Otestuj build: `rm -rf .next && NEXTAUTH_SECRET=super-tajny-klic-pro-weight-tracker-app-2026 npm run build`
2. Pokud OK, commitni a pushni:
```bash
git add .
git commit -m "Feature: popis"
git push
```
3. Zerops automaticky buildne a deployne z GitHubu

## ZNAMA UPOZORNENI

- **bcryptjs Edge Runtime warning** - middleware importuje auth.ts ktery importuje bcryptjs. Neni to fatal error, jen warning. Pokud chces opravit: vytvor `src/lib/auth.edge.ts` s minimal config (bez bcrypt) a pouzij ho v middleware.
- **Prisma generate** musi bezet po kazde zmene schema - v Zerops je v buildCommands
- **NEXTAUTH_SECRET** musi byt stejny v buildCommands i envVariables
- **HOSTNAME env var** NESMI byt v zerops.yml envVariables - Zerops ma systemovou promennou `hostname`
- **canvas-confetti** neni SSR-safe - importuj dynamicky nebo pouzij `"use client"` + useEffect
- Pokud neco nejde na Zerops ale lokalne jo, zkus `rm -rf node_modules` v buildCommands (uz tam je)
