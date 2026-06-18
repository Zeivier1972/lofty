"use client"

import { useEffect } from "react"

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[PWA] SW registered:", reg.scope))
        .catch((err) => console.warn("[PWA] SW registration failed:", err))
    }
  }, [])

  return null
}
