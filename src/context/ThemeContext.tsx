import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeContextType {
  theme: string;
  isDark: boolean;
  setTheme: (theme: string) => void;
  toggleDark: () => void;
}

const themes = [
  { id: "emerald-gold", name: "Emerald & Gold", description: "Classic luxury feel" },
  { id: "slate-indigo", name: "Slate & Indigo", description: "Modern tech vibe" },
  { id: "warm-sand", name: "Warm Sand", description: "Earthy & natural" },
  { id: "royal-navy", name: "Royal Navy", description: "Deep & sophisticated" },
];

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("2bn-theme") || "emerald-gold";
    }
    return "emerald-gold";
  });

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("2bn-dark-mode");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Handle dark mode
    if (isDark) {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }

    // Handle color theme
    body.setAttribute("data-theme", theme);
    localStorage.setItem("2bn-theme", theme);
    localStorage.setItem("2bn-dark-mode", isDark.toString());
  }, [theme, isDark]);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
  };

  const toggleDark = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return { ...context, themes };
}
