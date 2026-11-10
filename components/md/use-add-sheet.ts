"use client"

import { useEffect, useState } from "react"

/**
 * Open state of a page's "Add …" side sheet. `?add` in the address opens it
 * on arrival (the old /…/add pages redirect here), then leaves the address.
 */
export function useAddSheet(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("add")) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (no address on the server)
    setOpen(true)
    window.history.replaceState(null, "", window.location.pathname)
  }, [])
  return [open, setOpen]
}
