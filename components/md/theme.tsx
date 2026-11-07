"use client"

import { useEffect, useState } from "react"

export type ThemeChoice = "light" | "dark" | "system"
const KEY = "mdb-theme"

/**
 * Runs in <head> before the first paint (app/layout.tsx), so the page never
 * flashes the wrong theme: the stored choice, else the system setting.
 */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('${KEY}')||'system';var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.dataset.theme = dark ? "dark" : "light"
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  // Only used in client-rendered parts (the app frame renders after /me), so
  // reading storage in the initial state cannot cause a hydration mismatch.
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemeChoice) || "system"
    } catch {
      return "system"
    }
  })
  useEffect(() => {
    if (choice !== "system") return
    const mq = matchMedia("(prefers-color-scheme: dark)")
    const follow = () => apply("system")
    mq.addEventListener("change", follow)
    return () => mq.removeEventListener("change", follow)
  }, [choice])
  const set = (c: ThemeChoice) => {
    setChoice(c)
    try {
      localStorage.setItem(KEY, c)
    } catch {
      // not remembered, still applied
    }
    apply(c)
  }
  return [choice, set]
}
