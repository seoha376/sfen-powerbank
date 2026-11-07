import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const foundations = [
  {
    title: "Typed domain rules",
    description: "Battery lifecycle, station occupancy, and inventory rules.",
  },
  {
    title: "Supabase-ready data",
    description: "Versioned PostgreSQL migrations with integrity constraints.",
  },
  {
    title: "Executable verification",
    description: "Fast TypeScript tests plus optional local database tests.",
  },
] as const

function App() {
  return (
    <main className="min-h-svh bg-slate-950 px-6 py-16 text-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold tracking-[0.24em] text-cyan-300 uppercase">
            B0-A Core Foundation
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            SFEN Power Bank
          </h1>
          <p className="text-lg leading-8 text-slate-300">
            Shared Power Bank Circular Inventory Management System
          </p>
        </header>

        <section
          aria-label="Foundation status"
          className="grid gap-4 md:grid-cols-3"
        >
          {foundations.map((foundation) => (
            <Card
              key={foundation.title}
              className="border-white/10 bg-white/5 text-slate-50"
            >
              <CardHeader>
                <CardTitle>{foundation.title}</CardTitle>
                <CardDescription className="text-slate-400">
                  Foundation configured
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-slate-300">
                {foundation.description}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}

export default App
