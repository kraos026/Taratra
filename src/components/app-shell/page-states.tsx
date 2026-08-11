import type { ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="product-state">
      <LoaderCircle className="animate-spin" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="product-state">
      <Inbox />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="product-state error" role="alert">
      <AlertCircle />
      <h2>Une erreur est survenue</h2>
      <p>{message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
