"use client";
import { ErrorRecovery } from "@/shared/presentation/error-recovery";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <ErrorRecovery reset={reset} />;
}
