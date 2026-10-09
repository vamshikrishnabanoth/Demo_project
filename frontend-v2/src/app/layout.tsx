import type { Metadata } from "next";
import "./globals.css";
import React from "react";

export const metadata: Metadata = {
  title: "HalluciGuard - AI Telemetry Stream",
  description: "Live real-time 16-stage multi-agent telemetry stream and observability console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
            <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                  HG
                </div>
                <div>
                  <h1 className="text-sm font-semibold tracking-tight text-foreground">
                    HalluciGuard AI
                  </h1>
                  <p className="text-[10px] text-muted-foreground font-mono leading-none">
                    16-STAGE TELEMETRY STREAM
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Observability Engine
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
