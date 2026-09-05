"use client";
import "./globals.css";
import { ErrorRecovery } from "@/shared/presentation/error-recovery";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{ margin: 0, background: "#020617", color: "#f1f5f9", fontFamily: "sans-serif" }}
      >
        <ErrorRecovery reset={reset} />
      </body>
    </html>
  );
}
