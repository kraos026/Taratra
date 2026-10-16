"use client";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceThemeContext } from "./workspace-theme";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

export type MenuEntry = {
  label: string;
  shortcut?: string;
  action?: () => void;
  unavailable?: string;
  children?: MenuEntry[];
};
export function CodexMenu({
  label,
  items,
  children,
  className = "",
}: {
  label: string;
  items: MenuEntry[];
  children?: ReactNode;
  className?: string;
}) {
  const theme = useContext(WorkspaceThemeContext);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [note, setNote] = useState("");
  let entries = items;
  for (const name of path) entries = entries.find((item) => item.label === name)?.children || [];
  function close() {
    setPosition(null);
    setPath([]);
    setNote("");
    trigger.current?.focus();
  }
  function open() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = Math.min(items.length * 44 + 16, window.innerHeight - 16);
    setPosition({
      top:
        rect.bottom + height + 4 <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - height - 4),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 310)),
    });
    setPath([]);
    setNote("");
  }
  useEffect(() => {
    if (!position) return;
    popup.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    function outside(event: PointerEvent) {
      if (
        !popup.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      ) {
        setPosition(null);
        setPath([]);
      }
    }
    function moved() {
      setPosition(null);
      setPath([]);
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", moved);
    };
  }, [position, path]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!position}
        onClick={() => (position ? close() : open())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            open();
          }
        }}
      >
        {children || label}
      </button>
      {position &&
        createPortal(
          <div
            ref={popup}
            data-platform-theme={theme}
            role="menu"
            aria-label={label}
            className="codex-popup"
            style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}
            onKeyDown={(event) => {
              const buttons = Array.from(
                popup.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") || [],
              );
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                        buttons.length;
                buttons[next]?.focus();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              } else if (event.key === "ArrowLeft" && path.length) {
                event.preventDefault();
                setPath(path.slice(0, -1));
              } else if (event.key === "ArrowRight") {
                const item = entries[current];
                if (item?.children) {
                  event.preventDefault();
                  setPath([...path, item.label]);
                }
              } else if (event.key === "Tab") {
                setPosition(null);
              }
            }}
          >
            {path.length > 0 && (
              <button
                type="button"
                className="codex-popup-back"
                onClick={() => setPath(path.slice(0, -1))}
              >
                ← {path.at(-1)}
              </button>
            )}
            {entries.map((item) => (
              <button
                type="button"
                role="menuitem"
                aria-label={item.label}
                key={item.label}
                aria-disabled={!!item.unavailable}
                aria-haspopup={item.children ? "menu" : undefined}
                onClick={() => {
                  if (item.unavailable) {
                    setNote(item.unavailable);
                    return;
                  }
                  if (item.children) {
                    setPath([...path, item.label]);
                    setNote("");
                    return;
                  }
                  close();
                  item.action?.();
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
                {item.children && <ChevronRight size={14} aria-hidden="true" />}
              </button>
            ))}
            {note && (
              <p role="status" className="codex-popup-note">
                {note}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
