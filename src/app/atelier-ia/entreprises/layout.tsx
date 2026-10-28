import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Optivos Workspace",
  description: "Votre espace pour les missions, équipes d’agents et workflows.",
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return children;
}
