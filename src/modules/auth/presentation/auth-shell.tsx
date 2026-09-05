import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OptivosLogo } from "@/components/brand/optivos-logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: { href: string; label: string };
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030817] px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute -top-40 -left-32 size-[32rem] rounded-full bg-blue-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 -bottom-48 size-[34rem] rounded-full bg-violet-600/10 blur-[140px]" />
      <div className="relative w-full max-w-md space-y-7">
        <div className="flex justify-center">
          <OptivosLogo subtitle="Audit et intelligence d’automatisation" />
        </div>
        <Card className="overflow-hidden border-white/10 bg-slate-950/75 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 [&_input]:border-white/15 [&_input]:bg-slate-900 [&_input]:text-slate-100 [&_label]:text-slate-200">
          <div className="h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />
          <CardHeader className="space-y-2 px-7 pt-7">
            <CardTitle className="font-['Manrope'] text-2xl tracking-[-0.03em]">{title}</CardTitle>
            <CardDescription className="leading-6 text-slate-400">{description}</CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">{children}</CardContent>
        </Card>
        {footer && (
          <p className="text-center text-sm text-slate-400">
            <Link className="text-blue-400 hover:text-blue-300" href={footer.href}>
              {footer.label}
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
