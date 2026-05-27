"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function readDom(): Theme {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}

/**
 * Read the current theme and subscribe to `data-theme` changes on `<html>`.
 *
 * The actual theme is set by an inline script in [`app/layout.tsx`](../app/layout.tsx)
 * before paint to avoid a light/dark flash, and persisted to localStorage.
 * Components observe the attribute via a MutationObserver so they re-render
 * whenever the toggle flips it.
 */
export function useTheme(): readonly [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => readDom());

  useEffect(() => {
    setTheme(readDom());
    const obs = new MutationObserver(() => setTheme(readDom()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  function set(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable (SSR, sandboxed iframe) */
    }
  }

  return [theme, set] as const;
}

/**
 * Snippet evaluated synchronously in `<head>` before React hydrates, so the
 * page paints with the correct background on the very first frame.
 */
export const themeBootstrapScript = `
(function() {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var preferred = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    var theme = stored === 'light' || stored === 'dark' ? stored : preferred;
    document.documentElement.dataset.theme = theme;
    requestAnimationFrame(function() {
      document.documentElement.classList.add('theme-ready');
    });
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`.trim();
