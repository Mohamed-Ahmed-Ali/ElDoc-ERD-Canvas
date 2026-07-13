import { useSyncExternalStore } from "react";

export type ThemeName = "light" | "dark" | "react-flow" | "turbo";

const STORAGE_KEY = "mc.theme";

function getStoredTheme(): ThemeName {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "react-flow" || val === "turbo") {
      return val;
    }
  } catch {
    // ignore
  }
  return "light";
}

let currentTheme = getStoredTheme();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export const themeStore = {
  get: () => currentTheme,
  set: (theme: ThemeName) => {
    currentTheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    emit();
  },
  subscribe,
};

export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get);
}
