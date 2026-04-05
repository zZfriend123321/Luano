import { create } from "zustand"

type ArgonStatus = "stopped" | "starting" | "running" | "error"

interface ArgonStore {
  status: ArgonStatus
  port: number | null
  setStatus: (s: ArgonStatus) => void
  setPort: (p: number | null) => void
}

export const useArgonStore = create<ArgonStore>((set) => ({
  status: "stopped",
  port: null,
  setStatus: (s) => set({ status: s }),
  setPort: (p) => set({ port: p })
}))
