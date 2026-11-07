import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Showcase } from "./showcase"

export const metadata: Metadata = { title: "Components" }

/**
 * Every shared component on one page, for building and reviewing screens.
 * Development only: a production build answers 404 (NODE_ENV is fixed at
 * build time, so the page is never part of the deployed site).
 */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <Showcase />
}
