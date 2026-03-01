import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeightFlow | Sledování váhy",
  description: "Profesionální sledování váhy s kalkulací kalorického deficitu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="min-h-screen">
        <div className="fixed inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-violet-500/3 rounded-full blur-3xl" />
        </div>
        {children}
      </body>
    </html>
  );
}
