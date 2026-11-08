import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StationManagementPage } from "@/features/stations/station-management-page"

const mocks = vi.hoisted(() => ({
  getCurrentAppUser: vi.fn(),
  listStations: vi.fn(),
  createStation: vi.fn(),
  updateStation: vi.fn(),
}))

vi.mock("@/auth/student-auth", () => ({
  getCurrentAppUser: mocks.getCurrentAppUser,
}))

vi.mock("@/features/stations/station-service", () => ({
  listStations: mocks.listStations,
  createStation: mocks.createStation,
  updateStation: mocks.updateStation,
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

const station = {
  stationId: "10000000-0000-0000-0000-000000000001",
  stationName: "Engineering Hall",
  location: "First floor",
  slotCapacity: 5,
  availableCount: 1,
  occupiedSlotCount: 3,
  remainingSlotCount: 2,
} as const

async function renderAdmin(stations = [station]) {
  mocks.listStations.mockResolvedValue(stations)
  render(<StationManagementPage />)
  return screen.findByRole("form", { name: "Station 등록" })
}

describe("station management", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getCurrentAppUser.mockResolvedValue(adminProfile)
  })

  it("registers a station and displays its computed counts", async () => {
    const user = userEvent.setup()
    const created = {
      ...station,
      stationId: "10000000-0000-0000-0000-000000000002",
      stationName: "Library",
      location: "Lobby",
      slotCapacity: 8,
      availableCount: 0,
      occupiedSlotCount: 0,
      remainingSlotCount: 8,
    }
    mocks.createStation.mockResolvedValue(created)
    const form = await renderAdmin([])

    await user.type(within(form).getByLabelText("Station 이름"), "Library")
    await user.type(within(form).getByLabelText("위치"), "Lobby")
    await user.type(within(form).getByLabelText("전체 슬롯"), "8")
    await user.click(within(form).getByRole("button", { name: "Station 등록" }))

    await waitFor(() => {
      expect(mocks.createStation).toHaveBeenCalledWith({
        stationName: "Library",
        location: "Lobby",
        slotCapacity: 8,
      })
    })
    expect(await screen.findByText("점유 0 / 전체 8")).toBeInTheDocument()
    expect(screen.getByText("남은 슬롯 8 · Available 0")).toBeInTheDocument()
  })

  it("rejects missing required station information before calling the RPC", async () => {
    const user = userEvent.setup()
    const form = await renderAdmin([])

    await user.click(within(form).getByRole("button", { name: "Station 등록" }))

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Station 이름과 위치를 모두 입력하세요.",
    )
    expect(mocks.createStation).not.toHaveBeenCalled()
  })

  it("rejects an invalid slot capacity before calling the RPC", async () => {
    const user = userEvent.setup()
    const form = await renderAdmin([])

    await user.type(within(form).getByLabelText("Station 이름"), "Library")
    await user.type(within(form).getByLabelText("위치"), "Lobby")
    await user.type(within(form).getByLabelText("전체 슬롯"), "-1")
    await user.click(within(form).getByRole("button", { name: "Station 등록" }))

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "전체 슬롯은 0 이상의 정수여야 합니다.",
    )
    expect(mocks.createStation).not.toHaveBeenCalled()
  })

  it("updates station information", async () => {
    const user = userEvent.setup()
    const updated = { ...station, location: "Second floor", slotCapacity: 6, remainingSlotCount: 3 }
    mocks.updateStation.mockResolvedValue(updated)
    await renderAdmin()
    const form = await screen.findByRole("form", { name: "Engineering Hall 수정" })

    await user.clear(within(form).getByLabelText("위치"))
    await user.type(within(form).getByLabelText("위치"), "Second floor")
    await user.clear(within(form).getByLabelText("전체 슬롯"))
    await user.type(within(form).getByLabelText("전체 슬롯"), "6")
    await user.click(within(form).getByRole("button", { name: "변경 저장" }))

    await waitFor(() => {
      expect(mocks.updateStation).toHaveBeenCalledWith(station.stationId, {
        stationName: "Engineering Hall",
        location: "Second floor",
        slotCapacity: 6,
      })
    })
    expect(await screen.findByText("점유 3 / 전체 6")).toBeInTheDocument()
  })

  it("shows the database capacity error when capacity is below occupancy", async () => {
    const user = userEvent.setup()
    mocks.updateStation.mockRejectedValue(
      new Error("slot_capacity cannot be less than occupied slots"),
    )
    await renderAdmin()
    const form = await screen.findByRole("form", { name: "Engineering Hall 수정" })

    await user.clear(within(form).getByLabelText("전체 슬롯"))
    await user.type(within(form).getByLabelText("전체 슬롯"), "2")
    await user.click(within(form).getByRole("button", { name: "변경 저장" }))

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "slot_capacity cannot be less than occupied slots",
    )
  })

  it("does not expose management controls to a normal user", async () => {
    mocks.getCurrentAppUser.mockResolvedValue({ ...adminProfile, role: "user" })
    render(<StationManagementPage />)

    expect(
      await screen.findByText("관리자 계정만 Station을 관리할 수 있습니다."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("form", { name: "Station 등록" })).not.toBeInTheDocument()
    expect(mocks.listStations).not.toHaveBeenCalled()
  })

  it("reports a station list failure without treating the admin as unauthenticated", async () => {
    mocks.listStations.mockRejectedValue(new Error("inventory view unavailable"))
    render(<StationManagementPage />)

    expect(
      await screen.findByText(
        "Station 목록을 불러오지 못했습니다: inventory view unavailable",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("form", { name: "Station 등록" })).toBeInTheDocument()
    expect(screen.queryByText("인증된 관리자 세션이 필요합니다.")).not.toBeInTheDocument()
  })

  it("requires an authenticated session", async () => {
    mocks.getCurrentAppUser.mockRejectedValue(new Error("No authenticated user is available."))
    render(<StationManagementPage />)

    expect(await screen.findByText("인증된 관리자 세션이 필요합니다.")).toBeInTheDocument()
    expect(screen.queryByRole("form", { name: "Station 등록" })).not.toBeInTheDocument()
  })
})
