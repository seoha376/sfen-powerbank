import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import App from "@/App"

describe("application shell", () => {
  it("renders the B1-A station management shell", () => {
    render(<App />)

    expect(
      screen.getByRole("heading", { name: /SFEN Power Bank/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/B1-A Station Management/i)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
