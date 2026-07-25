import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DriftWatch — AI-Powered SOC Behavioral Anomaly Detection",
  description: "Behavior has a rhythm. DriftWatch watches for the moment it breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#090d16] text-[#e2e8f0] min-h-full flex flex-col selection:bg-amber-500/30 selection:text-amber-200`}
      >
        {children}
      </body>
    </html>
  );
}
