import type { Metadata } from "next";
import "./globals.css";
import { HeaderStatusProvider } from "@/components/layout/HeaderStatusContext";
import { Navbar } from "@/components/layout/Navbar";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const metadata: Metadata = {
  title: "PLC Playground",
  description:
    "Interactive PLC training platform — wiring simulator and Modbus power meter playground",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LanguageProvider>
          <HeaderStatusProvider>
            <div className="flex h-screen flex-col">
              <Navbar />
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          </HeaderStatusProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
