import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type AppTheme = "dark" | "tokyo-night"

interface SettingsStore {
  language: string
  theme: AppTheme
  apiKey: string
  openaiKey: string
  provider: string
  model: string
  setLanguage: (lang: string) => void
  setTheme: (theme: AppTheme) => void
  setApiKey: (key: string) => void
  setOpenAIKey: (key: string) => void
  setProvider: (provider: string) => void
  setModel: (model: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      language: "en",
      theme: "tokyo-night" as AppTheme,
      apiKey: "",
      openaiKey: "",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setApiKey: (apiKey) => set({ apiKey }),
      setOpenAIKey: (openaiKey) => set({ openaiKey }),
      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model })
    }),
    {
      name: "luano-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        apiKey: state.apiKey,
        openaiKey: state.openaiKey,
        provider: state.provider,
        model: state.model
      })
    }
  )
)
