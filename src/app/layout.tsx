import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("voltex-theme-preference");if(t==="light"||(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light");document.documentElement.style.colorScheme="light";}else{document.documentElement.classList.add("dark");document.documentElement.classList.remove("light");document.documentElement.style.colorScheme="dark";}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col antialiased selection:bg-tedx-red selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
