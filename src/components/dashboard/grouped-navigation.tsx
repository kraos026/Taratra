"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Bot, ChevronDown, CircleGauge, Menu, X, type LucideIcon } from "lucide-react";

export type NavigationEntry = {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  count?: number;
};

type NavigationProps = { entries: NavigationEntry[]; mobile?: boolean };

/** Audit destinations keep their canonical URLs; the agent space stays behind its lab flag. */
export function GroupedNavigation({ entries, mobile = false }: NavigationProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => ({
    audit: entries.some(
      (entry) => entry.active && !["Vue d’ensemble", "Atelier IA"].includes(entry.label),
    ),
    agents: entries.some((entry) => entry.active && entry.label === "Atelier IA"),
  }));
  const overview = entries.filter((entry) => entry.label === "Vue d’ensemble");
  const audit = entries.filter((entry) => !["Vue d’ensemble", "Atelier IA"].includes(entry.label));
  const agents = entries.filter((entry) => entry.label === "Atelier IA");
  const groups = [
    { key: "audit" as const, label: "Audit", icon: CircleGauge, items: audit },
    { key: "agents" as const, label: "Orchestrateur & agents", icon: Bot, items: agents },
  ].filter((group) => group.items.length > 0);
  const controlClass =
    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400";

  function links(items: NavigationEntry[]) {
    return items.map(({ icon: Icon, label, href, active, count }) => (
      <Link
        key={label}
        href={href}
        aria-label={label === "Audit" ? "Parcours d’audit" : label}
        aria-current={active ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={`${controlClass} ${active ? "border-l-2 border-indigo-300 bg-indigo-400/10 font-semibold text-indigo-100" : "border-l-2 border-transparent"}`}
      >
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        <span>{label === "Audit" ? "Parcours d’audit" : label}</span>
        {!!count && <span className="ml-auto rounded bg-white/10 px-2 text-xs">{count}</span>}
      </Link>
    ));
  }

  return (
    <div
      className="optivos-grouped-navigation"
      onKeyDown={(event) => {
        if (mobile && event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      {mobile && (
        <button
          ref={trigger}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={`${id}-navigation`}
          onClick={() => setMenuOpen(!menuOpen)}
          className={controlClass}
        >
          {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}{" "}
          Menu
        </button>
      )}
      <nav
        id={`${id}-navigation`}
        hidden={mobile && !menuOpen}
        aria-label={mobile ? "Navigation principale mobile" : "Navigation principale"}
        className={mobile ? "max-h-[65dvh] space-y-2 overflow-y-auto p-1" : "space-y-2"}
      >
        {links(overview)}
        {groups.map(({ key, label, icon: Icon, items }) => (
          <div key={key}>
            <button
              type="button"
              aria-expanded={expanded[key]}
              aria-controls={`${id}-${key}`}
              className={controlClass}
              onClick={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}
            >
              <Icon size={18} className="shrink-0" aria-hidden="true" />
              <span>{label}</span>
              <ChevronDown
                size={16}
                className={`ml-auto shrink-0 ${expanded[key] ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div
              id={`${id}-${key}`}
              hidden={!expanded[key]}
              className="ml-4 space-y-2 border-l border-white/10 pl-2"
            >
              {links(items)}
              {key === "agents" && (
                <p className="px-3 py-2 text-xs leading-5 text-slate-400">
                  À venir : agents et compétences, connexions IA, Studio créatif.
                </p>
              )}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
