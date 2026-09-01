import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optivos — Audit et intelligence d’automatisation",
  description:
    "Optivos aide les dirigeants à comprendre leurs processus, prioriser les automatisations et décider avec des preuves traçables.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
