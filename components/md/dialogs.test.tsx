import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api"
import { ConfirmDialog, ModalForm } from "./dialogs"

function Confirm(props: { onConfirm: () => Promise<unknown> | void; typed?: string; onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <ConfirmDialog open={open} onClose={() => { setOpen(false); props.onClose?.() }} danger title="Delete list?"
      text="This can't be undone." confirmLabel="Delete list" typed={props.typed} onConfirm={props.onConfirm} />
  )
}

const confirmButton = () => screen.getByRole("button", { name: "Delete list" }) as HTMLButtonElement

describe("ConfirmDialog", () => {
  it("runs the action and closes", async () => {
    const onConfirm = vi.fn(async () => {})
    const onClose = vi.fn()
    render(<Confirm onConfirm={onConfirm} onClose={onClose} />)
    expect(screen.getByRole("dialog", { name: "Delete list?" })).toBeTruthy()
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("Cancel closes without running the action", () => {
    const onConfirm = vi.fn()
    render(<Confirm onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("typed variant: the button stays off until the exact text is typed", async () => {
    const onConfirm = vi.fn(async () => {})
    render(<Confirm onConfirm={onConfirm} typed="Spring leads" />)
    const input = screen.getByLabelText(/to confirm/)
    expect(confirmButton().disabled).toBe(true)
    fireEvent.change(input, { target: { value: "spring leads" } })
    expect(confirmButton().disabled).toBe(true)
    fireEvent.change(input, { target: { value: "Spring leads " } })
    expect(confirmButton().disabled).toBe(true)
    // Enter in the field must not get around the lock either.
    fireEvent.submit(input.closest("form")!)
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "Spring leads" } })
    expect(confirmButton().disabled).toBe(false)
    fireEvent.click(confirmButton())
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })

  it("keeps the dialog open with the reason when the action fails", async () => {
    const onConfirm = vi.fn(async () => {
      throw new ApiError(409, "LIST_IN_USE", "A validation job is using this list.")
    })
    render(<Confirm onConfirm={onConfirm} />)
    fireEvent.click(confirmButton())
    expect((await screen.findByRole("alert")).textContent).toContain("A validation job is using this list.")
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(confirmButton().disabled).toBe(false)
  })

  it("disables both buttons while the action runs", async () => {
    let finish: () => void = () => {}
    render(<Confirm onConfirm={() => new Promise<void>((r) => { finish = r })} />)
    fireEvent.click(confirmButton())
    await waitFor(() => expect(confirmButton().disabled).toBe(true))
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true)
    finish()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

function Form(props: { onSubmit: (name: string) => Promise<boolean | void> }) {
  const [open, setOpen] = useState(true)
  const [name, setName] = useState("")
  return (
    <ModalForm open={open} onClose={() => setOpen(false)} title="New list" submitLabel="Create list"
      canSubmit={name.trim() !== ""} onSubmit={() => props.onSubmit(name)}>
      <label htmlFor="n">Name</label>
      <input id="n" value={name} onChange={(e) => setName(e.target.value)} />
    </ModalForm>
  )
}

describe("ModalForm", () => {
  it("submits with Enter, sends what was typed and closes", async () => {
    const onSubmit = vi.fn(async () => {})
    render(<Form onSubmit={onSubmit} />)
    const submit = screen.getByRole("button", { name: "Create list" }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const input = screen.getByLabelText("Name")
    fireEvent.change(input, { target: { value: "Spring leads" } })
    fireEvent.submit(input.closest("form")!)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onSubmit).toHaveBeenCalledWith("Spring leads")
  })

  it("stays open when onSubmit answers false, and shows a failure without losing the input", async () => {
    const onSubmit = vi.fn<(name: string) => Promise<boolean | void>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new ApiError(0, "NETWORK", "offline"))
    render(<Form onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } })
    fireEvent.click(screen.getByRole("button", { name: "Create list" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("dialog")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Create list" }))
    expect((await screen.findByRole("alert")).textContent).toContain("cannot be reached")
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("X")
  })
})
