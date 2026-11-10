import { redirect } from "next/navigation"

/** Adding now happens in a side sheet on the list page; old links land there with it open. */
export default function AddPage() {
  redirect("/servers/list?add")
}
