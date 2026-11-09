import * as React from "react"

import { cn } from "@/lib/utils"

function Button({ className, type = "button", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
