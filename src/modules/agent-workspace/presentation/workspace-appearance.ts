"use client";
import { useSyncExternalStore } from "react";
import type { WorkspaceAppearance } from "./codex-settings";

const key = "optivos.workspace.appearance.v1";
const defaults: WorkspaceAppearance = { messageSize: 14, reduceMotion: false, compact: false };
const serverValue = JSON.stringify(defaults);
let fallback = serverValue;
let memoryOnly = false;
function snapshot() {
  if (memoryOnly) return fallback;
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function decode(value: string): WorkspaceAppearance {
  try {
    const item = JSON.parse(value) as Partial<WorkspaceAppearance>;
    if (
      item &&
      [12, 14, 16, 18].includes(Number(item.messageSize)) &&
      typeof item.reduceMotion === "boolean" &&
      typeof item.compact === "boolean"
    )
      return {
        messageSize: Number(item.messageSize),
        reduceMotion: item.reduceMotion,
        compact: item.compact,
      };
  } catch {
    /* Invalid browser preferences fall back to safe display defaults. */
  }
  return defaults;
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("optivos-appearance", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("optivos-appearance", listener);
  };
}
export function useWorkspaceAppearance(onError: (message: string) => void) {
  const value = useSyncExternalStore(subscribe, snapshot, () => serverValue);
  function update(
    next: WorkspaceAppearance | ((current: WorkspaceAppearance) => WorkspaceAppearance),
  ) {
    const result = typeof next === "function" ? next(decode(snapshot())) : next;
    fallback = JSON.stringify(decode(JSON.stringify(result)));
    try {
      localStorage.setItem(key, fallback);
      memoryOnly = false;
    } catch {
      memoryOnly = true;
      onError(
        "Préférences appliquées pour cette page ; l’enregistrement dans le navigateur est indisponible.",
      );
    }
    window.dispatchEvent(new Event("optivos-appearance"));
  }
  return [decode(value), update] as const;
}
