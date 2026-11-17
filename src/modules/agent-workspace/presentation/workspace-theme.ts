"use client";
import { createContext, useSyncExternalStore } from "react";
export type WorkspaceTheme = "light" | "dark";
export const WorkspaceThemeContext = createContext<WorkspaceTheme | undefined>(undefined);
const key = "optivos.workspace.theme.v2";
let fallback: WorkspaceTheme = "dark";
let memoryOnly = false;
function snapshot(): WorkspaceTheme {
  if (memoryOnly) return fallback;
  try {
    return localStorage.getItem(key) === "light"
      ? "light"
      : localStorage.getItem(key) === "dark"
        ? "dark"
        : fallback;
  } catch {
    return fallback;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("optivos-theme-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("optivos-theme-change", listener);
  };
}
export function useWorkspaceTheme(onStorageError?: () => void) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "dark" as const);
  function setTheme(value: WorkspaceTheme) {
    fallback = value;
    try {
      localStorage.setItem(key, value);
      memoryOnly = false;
    } catch {
      memoryOnly = true;
      onStorageError?.();
    }
    window.dispatchEvent(new Event("optivos-theme-change"));
  }
  return [theme, setTheme] as const;
}
