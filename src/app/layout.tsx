import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import SessionProvider from "@/components/SessionProvider";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeightFlow | Sledování váhy",
  description: "Profesionální sledování váhy s kalkulací kalorického deficitu",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="cs">
      <body className="min-h-screen">
        <ThemeProvider>
          <SessionProvider session={session}>
            <div className="fixed inset-0 -z-10">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/15 dark:bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/12 dark:bg-cyan-500/5 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-violet-500/8 dark:bg-violet-500/3 rounded-full blur-3xl" />
            </div>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
