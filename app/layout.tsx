import "./globals.css";
import type { ReactNode } from "react";
import Header from "@/components/Header";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="min-h-screen flex items-start justify-center pt-24">
          {children}
        </main>
      </body>
    </html>
  );
}
