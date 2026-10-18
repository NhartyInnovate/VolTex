import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "TEDxGwarinpa | Volunteer Ticket Sales Challenge",
  description:
    "Official ticket sales challenge and leaderboard for TEDxGwarinpa volunteers. Share conference links, report ticket referrals, earn points, and climb the leaderboard.",
  keywords: [
    "TEDx",
    "TEDxGwarinpa",
    "Abuja",
    "Volunteer Challenge",
    "Ticket Sales",
    "Leaderboard",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col antialiased selection:bg-tedx-red selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
