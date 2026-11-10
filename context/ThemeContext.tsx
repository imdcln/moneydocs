"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ThemeColorId,
  ThemeColorConfig,
  THEME_COLORS,
  DEFAULT_THEME_COLOR,
  getThemeColorConfig,
} from "@/lib/theme";

interface ThemeContextType {
  colorId: ThemeColorId;
  currentColor: ThemeColorConfig;
  allColors: ThemeColorConfig[];
  setColor: (id: ThemeColorId) => void;
  resetColor: () => void;
  isThemeLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colorId: DEFAULT_THEME_COLOR,
  currentColor: getThemeColorConfig(DEFAULT_THEME_COLOR),
  allColors: THEME_COLORS,
  setColor: () => {},
  resetColor: () => {},
  isThemeLoaded: false,
});

const STORAGE_KEY = "dclne_theme_color";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorId, setColorId] = useState<ThemeColorId>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as ThemeColorId | null;
        if (saved && THEME_COLORS.some((c) => c.id === saved)) {
          return saved;
        }
      } catch {}
    }
    return DEFAULT_THEME_COLOR;
  });
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  const applyColor = (id: ThemeColorId) => {
    setColorId(id);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, id);
        document.documentElement.setAttribute("data-theme-color", id);
        const config = getThemeColorConfig(id);
        const root = document.documentElement;
        root.style.setProperty("--color-primary", config.primary);
        root.style.setProperty("--color-primary-hover", config.primaryHover);
        root.style.setProperty("--color-primary-light", config.primaryLight);
        root.style.setProperty("--color-primary-dark", config.primaryDark);
        root.style.setProperty("--color-primary-glow", config.glow);
        root.style.setProperty("--color-primary-subtle", config.subtle);
        root.style.setProperty("--color-primary-border", config.border);
      } catch {
        // Ignore localStorage restrictions
      }
    }
  };

  const resetColor = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage restrictions
    }
    applyColor(DEFAULT_THEME_COLOR);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeColorId | null;
      if (saved && THEME_COLORS.some((c) => c.id === saved)) {
        applyColor(saved);
      } else {
        applyColor(DEFAULT_THEME_COLOR);
      }
    } catch {
      applyColor(DEFAULT_THEME_COLOR);
    } finally {
      setIsThemeLoaded(true);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newColor = e.newValue as ThemeColorId;
        if (THEME_COLORS.some((c) => c.id === newColor)) {
          setColorId(newColor);
          document.documentElement.setAttribute("data-theme-color", newColor);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        colorId,
        currentColor: getThemeColorConfig(colorId),
        allColors: THEME_COLORS,
        setColor: applyColor,
        resetColor,
        isThemeLoaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
