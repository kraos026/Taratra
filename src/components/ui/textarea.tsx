import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
