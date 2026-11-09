import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StationManagementPage } from "@/features/stations/station-management-page"

const mocks = vi.hoisted(() => ({
  getCurrentAppUser: vi.fn(),
  listStations: vi.fn(),
  createStation: vi.fn(),
  updateStation: vi.fn(),
  listBatteries: vi.fn(),
  registerBattery: vi.fn(),
  relocateBattery: vi.fn(),
}))

vi.mock("@/auth/student-auth", () => ({
  getCurrentAppUser: mocks.getCurrentAppUser,
}))

vi.mock("@/features/stations/station-service", () => ({
  listStations: mocks.listStations,
  createStation: mocks.createStation,
  updateStation: mocks.updateStation,
}))

vi.mock("@/features/batteries/battery-service", () => ({
  listBatteries: mocks.listBatteries,
  registerBattery: mocks.registerBattery,
  relocateBattery: mocks.relocateBattery,
}))

const adminProfile = {
  userId: "admin-root",
  authUserId: "00000000-0000-0000-0000-000000000001",
  userName: "Administrator",
  role: "administrator",
  userStatus: null,
  approvalStatus: null,
  eligibilityStatus: false,
  suspensionType: "none",
  suspendedUntil: null,
  graduationYear: null,
  certificateFile: null,
} as const

const stations = [
  {
    stationId: "10000000-0000-4000-8000-000000000001",
    stationName: "Full Station",
    location: "Engineering Hall",
    slotCapacity: 2,
    availableCount: 1,
    occupiedSlotCount: 2,
    remainingSlotCount: 0,
  },
  {
    stationId: "10000000-0000-4000-8000-000000000002",
    stationName: "Empty Station",
    location: "Library",
    slotCapacity: 3,
    availableCount: 0,
    occupiedSlotCount: 0,
    remainingSlotCount: 3,
  },
] as const

const batteries = [
  {
    batteryId: "20000000-0000-4000-8000-000000000001",
    modelName: "SFEN-10K",
    capacity: 10000,
    cycleLife: 500,
    usedCount: 0,
    status: "Charging",
    stationId: stations[0].stationId,
    currentCharge: 0,
    chargeStartedAt: "2026-11-09T00:00:00Z",
    disposalConfirmedAt: null,
  },
  {
    batteryId: "20000000-0000-4000-8000-000000000002",
    modelName: "SFEN-10K",
    capacity: 10000,
    cycleLife: 500,
    usedCount: 1,
    status: "Rented",
    stationId: stations[0].stationId,
    currentCharge: 80,
    chargeStartedAt: null,
    disposalConfirmedAt: null,
  },
] as const

async function renderAdmin() {
  render(<StationManagementPage />)
  return screen.findByRole("form", { name: "Battery 등록" })
}

describe("battery registration and relocation", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getCurrentAppUser.mockResolvedValue(adminProfile)
    mocks.listStations.mockResolvedValue(stations)
    mocks.listBatteries.mockResolvedValue(batteries)
    mocks.registerBattery.mockResolvedValue(undefined)
    mocks.relocateBattery.mockResolvedValue(undefined)
  })

  it("registers a battery through the database RPC and refreshes inventory", async () => {
    const user = userEvent.setup()
    const form = await renderAdmin()

    await user.type(
      within(form).getByLabelText("Battery ID"),
      "30000000-0000-4000-8000-000000000001",
    )
    await user.type(within(form).getByLabelText("Model name"), "SFEN-20K")
    await user.type(within(form).getByLabelText("Capacity (mAh)"), "20000")
    await user.type(within(form).getByLabelText("Cycle life"), "600")
    await user.selectOptions(
      within(form).getByLabelText("등록 Station"),
      stations[1].stationId,
    )
    await user.click(within(form).getByRole("button", { name: "Battery 등록" }))

    await waitFor(() => {
      expect(mocks.registerBattery).toHaveBeenCalledWith({
        batteryId: "30000000-0000-4000-8000-000000000001",
        modelName: "SFEN-20K",
        capacity: 20000,
        cycleLife: 600,
        stationId: stations[1].stationId,
      })
    })
    expect(await screen.findByText("Battery가 등록되었습니다.")).toBeInTheDocument()
    expect(mocks.listStations).toHaveBeenCalledTimes(2)
    expect(mocks.listBatteries).toHaveBeenCalledTimes(2)
  })

  it("disables a full station as a registration destination", async () => {
    const form = await renderAdmin()
    const stationSelect = within(form).getByLabelText("등록 Station")

    expect(within(stationSelect).getByRole("option", { name: "Full Station (2/2)" })).toBeDisabled()
    expect(within(stationSelect).getByRole("option", { name: "Empty Station (0/3)" })).toBeEnabled()
  })

  it("rejects invalid registration values before calling the RPC", async () => {
    const user = userEvent.setup()
    const form = await renderAdmin()

    await user.type(within(form).getByLabelText("Battery ID"), "not-a-uuid")
    await user.click(within(form).getByRole("button", { name: "Battery 등록" }))

    expect(await screen.findByText("Battery ID는 유효한 UUID여야 합니다.")).toBeInTheDocument()
    expect(mocks.registerBattery).not.toHaveBeenCalled()
  })

  it("relocates an allowed battery and keeps non-relocatable batteries disabled", async () => {
    const user = userEvent.setup()
    await renderAdmin()
    const form = screen.getByRole("form", { name: "Battery 재배치" })

    await user.selectOptions(
      within(form).getByLabelText("출발 Station"),
      stations[0].stationId,
    )
    const batterySelect = within(form).getByLabelText("Battery")
    expect(
      within(batterySelect).getByRole("option", {
        name: `${batteries[1].batteryId} · Rented`,
      }),
    ).toBeDisabled()

    await user.selectOptions(batterySelect, batteries[0].batteryId)
    await user.selectOptions(
      within(form).getByLabelText("도착 Station"),
      stations[1].stationId,
    )
    await user.click(within(form).getByRole("button", { name: "Battery 재배치" }))

    await waitFor(() => {
      expect(mocks.relocateBattery).toHaveBeenCalledWith({
        batteryId: batteries[0].batteryId,
        originStationId: stations[0].stationId,
        destinationStationId: stations[1].stationId,
      })
    })
    expect(await screen.findByText("Battery가 재배치되었습니다.")).toBeInTheDocument()
  })

  it("shows a database relocation failure", async () => {
    const user = userEvent.setup()
    mocks.relocateBattery.mockRejectedValue(new Error("station capacity would be exceeded"))
    await renderAdmin()
    const form = screen.getByRole("form", { name: "Battery 재배치" })

    await user.selectOptions(within(form).getByLabelText("출발 Station"), stations[0].stationId)
    await user.selectOptions(within(form).getByLabelText("Battery"), batteries[0].batteryId)
    await user.selectOptions(within(form).getByLabelText("도착 Station"), stations[1].stationId)
    await user.click(within(form).getByRole("button", { name: "Battery 재배치" }))

    expect(await screen.findByText("station capacity would be exceeded")).toBeInTheDocument()
  })
})
