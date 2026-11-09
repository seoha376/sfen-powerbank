import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-10 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
