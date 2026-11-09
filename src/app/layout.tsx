import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RubiconArb | Atomic Cross-VM Arbitrage Engine & Simulation Network on Rome",
  description:
    "An atomic arbitrage engine and simulator trading Rome EVM liquidity against Solana DEXs in one ~400ms Solana transaction via Rome CPI precompiles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#060911] text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
