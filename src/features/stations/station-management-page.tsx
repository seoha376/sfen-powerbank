import { useEffect, useState, type FormEvent } from "react"

import { getCurrentAppUser } from "@/auth/student-auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  createStation,
  listStations,
  updateStation,
  type StationInput,
  type StationOverview,
} from "@/features/stations/station-service"

interface StationDraft {
  stationName: string
  location: string
  slotCapacity: string
}

const emptyDraft: StationDraft = {
  stationName: "",
  location: "",
  slotCapacity: "",
}

function validateDraft(draft: StationDraft): StationInput {
  const stationName = draft.stationName.trim()
  const location = draft.location.trim()
  if (!stationName || !location) {
    throw new Error("Station 이름과 위치를 모두 입력하세요.")
  }
  if (!/^\d+$/.test(draft.slotCapacity.trim())) {
    throw new Error("전체 슬롯은 0 이상의 정수여야 합니다.")
  }
  const slotCapacity = Number(draft.slotCapacity)
  if (!Number.isSafeInteger(slotCapacity)) {
    throw new Error("전체 슬롯은 안전한 정수 범위여야 합니다.")
  }
  return { stationName, location, slotCapacity }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
}

function StationFields({
  draft,
  idPrefix,
  disabled,
  onChange,
}: {
  draft: StationDraft
  idPrefix: string
  disabled: boolean
  onChange: (draft: StationDraft) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="grid gap-2 text-sm font-medium" htmlFor={`${idPrefix}-name`}>
        Station 이름
        <Input
          id={`${idPrefix}-name`}
          value={draft.stationName}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, stationName: event.target.value })}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium" htmlFor={`${idPrefix}-location`}>
        위치
        <Input
          id={`${idPrefix}-location`}
          value={draft.location}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, location: event.target.value })}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium" htmlFor={`${idPrefix}-capacity`}>
        전체 슬롯
        <Input
          id={`${idPrefix}-capacity`}
          inputMode="numeric"
          value={draft.slotCapacity}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, slotCapacity: event.target.value })}
        />
      </label>
    </div>
  )
}

function StationEditor({
  station,
  onUpdated,
}: {
  station: StationOverview
  onUpdated: (station: StationOverview) => void
}) {
  const [draft, setDraft] = useState<StationDraft>({
    stationName: station.stationName,
    location: station.location,
    slotCapacity: String(station.slotCapacity),
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const input = validateDraft(draft)
      setSaving(true)
      const updated = await updateStation(station.stationId, input)
      onUpdated(updated)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-white/10 bg-white/5 text-slate-50">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>{station.stationName}</CardTitle>
            <CardDescription className="text-slate-400">{station.location}</CardDescription>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-right text-sm">
            <p className="font-semibold text-cyan-300">
              점유 {station.occupiedSlotCount} / 전체 {station.slotCapacity}
            </p>
            <p className="mt-1 text-slate-400">
              남은 슬롯 {station.remainingSlotCount} · Available {station.availableCount}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form aria-label={`${station.stationName} 수정`} className="grid gap-4" onSubmit={submit}>
          <StationFields
            draft={draft}
            idPrefix={`station-${station.stationId}`}
            disabled={saving}
            onChange={setDraft}
          />
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중…" : "변경 저장"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function StationManagementPage() {
  const [access, setAccess] = useState<"loading" | "allowed" | "unauthenticated" | "forbidden">("loading")
  const [stations, setStations] = useState<StationOverview[]>([])
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const profile = await getCurrentAppUser()
        if (!active) return
        if (profile.role !== "administrator") {
          setAccess("forbidden")
          return
        }
        setAccess("allowed")
        try {
          const data = await listStations()
          if (active) setStations(data)
        } catch (caught) {
          if (active) setLoadError(errorMessage(caught))
        }
      } catch {
        if (active) setAccess("unauthenticated")
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function submitCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const input = validateDraft(draft)
      setSaving(true)
      const created = await createStation(input)
      setStations((current) => [...current, created].sort((a, b) => a.stationName.localeCompare(b.stationName)))
      setDraft(emptyDraft)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const accessMessage =
    access === "loading"
      ? "관리자 세션을 확인하고 있습니다."
      : access === "forbidden"
        ? "관리자 계정만 Station을 관리할 수 있습니다."
        : "인증된 관리자 세션이 필요합니다."

  return (
    <main className="min-h-svh bg-slate-950 px-4 py-10 text-slate-50 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold tracking-[0.24em] text-cyan-300 uppercase">B1-A Station Management</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">SFEN Power Bank</h1>
          <p className="max-w-2xl text-slate-300">
            Station 수용량은 Battery의 현재 상태에서 계산되며, Available 재고와 슬롯 점유량은 별도로 표시됩니다.
          </p>
        </header>

        {access !== "allowed" ? (
          <Card className="border-white/10 bg-white/5 text-slate-50">
            <CardHeader>
              <CardTitle>접근 제한</CardTitle>
              <CardDescription className="text-slate-400">{accessMessage}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card className="border-cyan-300/20 bg-cyan-300/5 text-slate-50">
              <CardHeader>
                <CardTitle>Station 등록</CardTitle>
                <CardDescription className="text-slate-400">이름, 위치, 전체 슬롯을 입력하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <form aria-label="Station 등록" className="grid gap-4" onSubmit={submitCreate}>
                  <StationFields draft={draft} idPrefix="new-station" disabled={saving} onChange={setDraft} />
                  {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
                  <div>
                    <Button type="submit" disabled={saving}>{saving ? "등록 중…" : "Station 등록"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <section aria-labelledby="station-list-title" className="grid gap-4">
              <div>
                <h2 id="station-list-title" className="text-2xl font-semibold">Station 목록</h2>
                <p className="mt-1 text-sm text-slate-400">총 {stations.length}개 Station</p>
              </div>
              {loadError ? (
                <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-300/5 p-4 text-rose-200">
                  Station 목록을 불러오지 못했습니다: {loadError}
                </p>
              ) : stations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-slate-400">등록된 Station이 없습니다.</p>
              ) : (
                stations.map((station) => (
                  <StationEditor
                    key={station.stationId}
                    station={station}
                    onUpdated={(updated) => setStations((current) => current.map((item) => item.stationId === updated.stationId ? updated : item))}
                  />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
