import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLC Playground — Wiring Simulator",
  description: "Interactive PLC wiring trainer connected to real FX3U hardware",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
