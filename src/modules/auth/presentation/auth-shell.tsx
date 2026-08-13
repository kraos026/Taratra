import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="flex min-h-screen items-center justify-center bg-[#050914] px-4 py-10 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold tracking-[0.22em] text-blue-400">AUTOMATEX</p>
          <p className="mt-2 text-sm text-slate-400">Enterprise Automation Intelligence</p>
        </div>
        <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-blue-950/20">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="text-slate-400">{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
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
