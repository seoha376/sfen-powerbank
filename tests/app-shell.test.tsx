import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import App from "@/App"

describe("application shell", () => {
  it("renders the B0-A foundation without workflow controls", () => {
    render(<App />)

    expect(
      screen.getByRole("heading", { name: /SFEN Power Bank/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/B0-A Core Foundation/i)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
