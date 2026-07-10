"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "../constants";

type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const nextTheme = savedTheme === "light" ? "light" : "dark";
      setTheme(nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    }, 0);
  }, []);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  }

  return { theme, toggleTheme };
}
