import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutomateX — Audit d'automatisation IA",
  description: "Transformez les processus répétitifs en opportunités mesurables.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
