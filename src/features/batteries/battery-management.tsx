import { useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { canTransitionBatteryStatus } from "@/domain/battery-status"
import {
  registerBattery,
  relocateBattery,
  type BatteryOverview,
  type RegisterBatteryInput,
} from "@/features/batteries/battery-service"
import type { StationOverview } from "@/features/stations/station-service"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const selectClassName =
  "min-h-10 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"

interface RegistrationDraft {
  batteryId: string
  modelName: string
  capacity: string
  cycleLife: string
  stationId: string
}

const emptyRegistration: RegistrationDraft = {
  batteryId: "",
  modelName: "",
  capacity: "",
  cycleLife: "",
  stationId: "",
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다."
}

function positiveInteger(value: string, label: string): number {
  if (!/^[1-9]\d*$/.test(value.trim())) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label}이(가) 안전한 정수 범위를 벗어났습니다.`)
  }
  return parsed
}

function validateRegistration(draft: RegistrationDraft): RegisterBatteryInput {
  const batteryId = draft.batteryId.trim()
  const modelName = draft.modelName.trim()
  if (!UUID_PATTERN.test(batteryId)) {
    throw new Error("Battery ID는 유효한 UUID여야 합니다.")
  }
  if (!modelName) throw new Error("Model name을 입력하세요.")
  if (!draft.stationId) throw new Error("등록 Station을 선택하세요.")

  return {
    batteryId,
    modelName,
    capacity: positiveInteger(draft.capacity, "Capacity"),
    cycleLife: positiveInteger(draft.cycleLife, "Cycle life"),
    stationId: draft.stationId,
  }
}

function sortStations(stations: readonly StationOverview[]): StationOverview[] {
  return [...stations].sort(
    (left, right) =>
      left.occupiedSlotCount - right.occupiedSlotCount ||
      left.stationName.localeCompare(right.stationName),
  )
}

export function BatteryManagement({
  stations,
  batteries,
  onRefresh,
}: {
  stations: readonly StationOverview[]
  batteries: readonly BatteryOverview[]
  onRefresh: () => Promise<void>
}) {
  const [registration, setRegistration] = useState(emptyRegistration)
  const [originStationId, setOriginStationId] = useState("")
  const [batteryId, setBatteryId] = useState("")
  const [destinationStationId, setDestinationStationId] = useState("")
  const [busy, setBusy] = useState<"register" | "relocate" | null>(null)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const [relocationMessage, setRelocationMessage] = useState<string | null>(null)
  const sortedStations = useMemo(() => sortStations(stations), [stations])

  const originBatteries = batteries.filter(
    (battery) => battery.stationId === originStationId,
  )
  const destinations = sortedStations.filter(
    (station) =>
      station.stationId !== originStationId && station.remainingSlotCount > 0,
  )

  async function submitRegistration(event: FormEvent) {
    event.preventDefault()
    setRegistrationMessage(null)
    try {
      const input = validateRegistration(registration)
      setBusy("register")
      await registerBattery(input)
      await onRefresh()
      setRegistration(emptyRegistration)
      setRegistrationMessage("Battery가 등록되었습니다.")
    } catch (error) {
      setRegistrationMessage(messageFrom(error))
    } finally {
      setBusy(null)
    }
  }

  async function submitRelocation(event: FormEvent) {
    event.preventDefault()
    setRelocationMessage(null)
    if (!originStationId || !batteryId || !destinationStationId) {
      setRelocationMessage("출발 Station, Battery, 도착 Station을 모두 선택하세요.")
      return
    }

    try {
      setBusy("relocate")
      await relocateBattery({
        batteryId,
        originStationId,
        destinationStationId,
      })
      await onRefresh()
      setBatteryId("")
      setDestinationStationId("")
      setRelocationMessage("Battery가 재배치되었습니다.")
    } catch (error) {
      setRelocationMessage(messageFrom(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="battery-management-title" className="grid gap-6">
      <div>
        <h2 id="battery-management-title" className="text-2xl font-semibold">
          Battery 관리
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          등록과 재배치는 DB Transaction에서 권한·수용량·History를 검증합니다.
        </p>
      </div>

      <Card className="border-cyan-300/20 bg-cyan-300/5 text-slate-50">
        <CardHeader>
          <CardTitle>Battery 등록</CardTitle>
          <CardDescription className="text-slate-400">
            빈 슬롯이 있는 Station에 Charging 상태로 등록됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form aria-label="Battery 등록" className="grid gap-4" onSubmit={submitRegistration}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="grid gap-2 text-sm font-medium">
                Battery ID
                <Input
                  value={registration.batteryId}
                  disabled={busy !== null}
                  onChange={(event) =>
                    setRegistration({ ...registration, batteryId: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Model name
                <Input
                  value={registration.modelName}
                  disabled={busy !== null}
                  onChange={(event) =>
                    setRegistration({ ...registration, modelName: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Capacity (mAh)
                <Input
                  inputMode="numeric"
                  value={registration.capacity}
                  disabled={busy !== null}
                  onChange={(event) =>
                    setRegistration({ ...registration, capacity: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Cycle life
                <Input
                  inputMode="numeric"
                  value={registration.cycleLife}
                  disabled={busy !== null}
                  onChange={(event) =>
                    setRegistration({ ...registration, cycleLife: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                등록 Station
                <select
                  className={selectClassName}
                  value={registration.stationId}
                  disabled={busy !== null}
                  onChange={(event) =>
                    setRegistration({ ...registration, stationId: event.target.value })
                  }
                >
                  <option value="">선택</option>
                  {sortedStations.map((station) => (
                    <option
                      key={station.stationId}
                      value={station.stationId}
                      disabled={station.remainingSlotCount === 0}
                    >
                      {station.stationName} ({station.occupiedSlotCount}/{station.slotCapacity})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {registrationMessage && (
              <p role="status" className="text-sm text-cyan-200">
                {registrationMessage}
              </p>
            )}
            <div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "register" ? "등록 중…" : "Battery 등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-slate-50">
        <CardHeader>
          <CardTitle>Battery 재배치</CardTitle>
          <CardDescription className="text-slate-400">
            Charging, Available, UnderRepair 상태만 이동할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form aria-label="Battery 재배치" className="grid gap-4" onSubmit={submitRelocation}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium">
                출발 Station
                <select
                  className={selectClassName}
                  value={originStationId}
                  disabled={busy !== null}
                  onChange={(event) => {
                    setOriginStationId(event.target.value)
                    setBatteryId("")
                    setDestinationStationId("")
                  }}
                >
                  <option value="">선택</option>
                  {sortedStations.map((station) => (
                    <option key={station.stationId} value={station.stationId}>
                      {station.stationName} ({station.occupiedSlotCount}/{station.slotCapacity})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Battery
                <select
                  className={selectClassName}
                  value={batteryId}
                  disabled={busy !== null || !originStationId}
                  onChange={(event) => setBatteryId(event.target.value)}
                >
                  <option value="">선택</option>
                  {originBatteries.map((battery) => (
                    <option
                      key={battery.batteryId}
                      value={battery.batteryId}
                      disabled={
                        !canTransitionBatteryStatus(
                          battery.status,
                          battery.status,
                          { relocation: true },
                        )
                      }
                    >
                      {battery.batteryId} · {battery.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                도착 Station
                <select
                  className={selectClassName}
                  value={destinationStationId}
                  disabled={busy !== null || !originStationId}
                  onChange={(event) => setDestinationStationId(event.target.value)}
                >
                  <option value="">선택</option>
                  {destinations.map((station) => (
                    <option key={station.stationId} value={station.stationId}>
                      {station.stationName} ({station.occupiedSlotCount}/{station.slotCapacity})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {relocationMessage && (
              <p role="status" className="text-sm text-cyan-200">
                {relocationMessage}
              </p>
            )}
            <div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "relocate" ? "재배치 중…" : "Battery 재배치"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <h3 className="text-xl font-semibold">Battery 목록</h3>
        {batteries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-slate-400">
            등록된 Battery가 없습니다.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batteries.map((battery) => {
              const station = stations.find((item) => item.stationId === battery.stationId)
              return (
                <Card key={battery.batteryId} className="gap-3 border-white/10 bg-white/5 py-4 text-slate-50">
                  <CardHeader className="gap-1 px-4">
                    <CardTitle className="break-all text-sm">{battery.batteryId}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {battery.modelName} · {battery.capacity.toLocaleString()} mAh
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 text-sm text-slate-300">
                    <p>{battery.status} · 충전 {battery.currentCharge}%</p>
                    <p className="mt-1">{station?.stationName ?? "Station 없음"}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
