import { AppShell } from "@/components/app-shell/app-shell";

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
