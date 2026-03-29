import { create } from "zustand"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

interface AIStore {
  messages: ChatMessage[]
  isStreaming: boolean
  globalSummary: string
  planMode: boolean
  autoAccept: boolean

  addMessage: (msg: Omit<ChatMessage, "id">) => string
  updateMessage: (id: string, content: string, streaming?: boolean) => void
  setStreaming: (v: boolean) => void
  setGlobalSummary: (s: string) => void
  clearMessages: () => void
  setPlanMode: (v: boolean) => void
  setAutoAccept: (v: boolean) => void
}

export const useAIStore = create<AIStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  globalSummary: "",
  planMode: false,
  autoAccept: false,

  addMessage: (msg) => {
    const id = `${Date.now()}-${Math.random()}`
    set({ messages: [...get().messages, { ...msg, id }] })
    return id
  },

  updateMessage: (id, content, streaming) =>
    set({
      messages: get().messages.map((m) =>
        m.id === id ? { ...m, content, streaming: streaming ?? m.streaming } : m
      )
    }),

  setStreaming: (v) => set({ isStreaming: v }),
  setGlobalSummary: (s) => set({ globalSummary: s }),
  clearMessages: () => set({ messages: [] }),
  setPlanMode: (v) => set({ planMode: v }),
  setAutoAccept: (v) => set({ autoAccept: v })
}))
