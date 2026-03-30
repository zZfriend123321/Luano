import { useState, useEffect } from "react"
import { useSettingsStore } from "../stores/settingsStore"
import { useProjectStore } from "../stores/projectStore"
import { useT } from "../i18n/useT"

interface SettingsPanelProps {
  onClose: () => void
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "\ud55c\uad6d\uc5b4" }
]

interface ModelEntry { id: string; label: string }
interface ProviderModels { anthropic: ModelEntry[]; openai: ModelEntry[] }

interface CustomSkill {
  command: string
  label: string
  description: string
  prompt: string
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--text-muted)"
      }}
    >
      {children}
    </span>
  )
}

function KeyField({
  label,
  placeholder,
  isSet,
  onSave
}: {
  label: string
  placeholder: string
  isSet: boolean
  onSave: (key: string) => Promise<void>
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)
  const t = useT()

  const handleSave = async () => {
    if (!input.trim()) return
    setSaving(true)
    await onSave(input.trim())
    setInput("")
    setEditing(false)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      {editing ? (
        <div className="flex gap-2">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={placeholder}
            autoFocus
            className="flex-1 rounded-lg px-3 py-2 transition-all duration-150 focus:outline-none"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: "12px"
            }}
            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"}
            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "white", fontSize: "12px" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--accent-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--accent)"}
          >
            {saving ? "\u2026" : t("save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-2 rounded-lg transition-all duration-150"
            style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "12px", border: "1px solid var(--border)" }}
          >
            {t("cancel")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 rounded-lg px-3 py-2"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              fontSize: "12px",
              color: isSet ? "var(--text-muted)" : "var(--text-ghost)"
            }}
          >
            {isSet ? "\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf\u25cf" : "Not configured"}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-lg transition-all duration-150 flex-shrink-0"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              fontSize: "12px",
              border: "1px solid var(--border)"
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)" }}
          >
            {isSet ? t("apiKeySet") : t("apiKeyNotSet")}
          </button>
        </div>
      )}
    </div>
  )
}

const THEMES = [
  { id: "dark" as const, label: "Dark" },
  { id: "tokyo-night" as const, label: "Tokyo Night" }
]

// ── Skill Editor ────────────────────────────────────────────────────────────

const EMPTY_SKILL: CustomSkill = { command: "/", label: "", description: "", prompt: "" }

function SkillEditor({
  skill,
  onSave,
  onCancel
}: {
  skill: CustomSkill
  onSave: (s: CustomSkill) => void
  onCancel: () => void
}): JSX.Element {
  const [form, setForm] = useState<CustomSkill>(skill)

  const update = (key: keyof CustomSkill, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const valid = form.command.startsWith("/") && form.command.length > 1 && form.label.trim() && form.prompt.trim()

  const inputStyle = {
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontSize: "12px",
    borderRadius: "6px",
    padding: "6px 10px",
    width: "100%",
    outline: "none"
  } as React.CSSProperties

  return (
    <div
      className="rounded-lg flex flex-col gap-2.5 p-3"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
    >
      <div className="flex gap-2">
        <div className="flex flex-col gap-1" style={{ width: 100 }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Command</span>
          <input
            value={form.command}
            onChange={(e) => update("command", e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="/myskill"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Label</span>
          <input
            value={form.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="My Skill"
            style={inputStyle}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Description</span>
        <input
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What this skill does"
          style={inputStyle}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          Prompt <span style={{ opacity: 0.6 }}>({"{selection}"} = code, {"{file}"} = path)</span>
        </span>
        <textarea
          value={form.prompt}
          onChange={(e) => update("prompt", e.target.value)}
          placeholder="Analyze the following code and..."
          rows={3}
          className="resize-none focus:outline-none"
          style={{ ...inputStyle, lineHeight: "1.5" }}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs transition-all duration-100"
          style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          Cancel
        </button>
        <button
          onClick={() => valid && onSave(form)}
          disabled={!valid}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-100 disabled:opacity-30"
          style={{ background: "var(--accent)", color: "white" }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ── Main Settings Panel ─────────────────────────────────────────────────────

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const { language, setLanguage, theme, setTheme, apiKey, setApiKey, openaiKey, setOpenAIKey, provider, setProvider, model, setModel } = useSettingsStore()
  const { projectPath } = useProjectStore()
  const t = useT()
  const [models, setModels] = useState<ProviderModels>({ anthropic: [], openai: [] })
  const [visible, setVisible] = useState(false)
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([])
  const [editingSkill, setEditingSkill] = useState<{ index: number; skill: CustomSkill } | null>(null)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)
  const [proStatus, setProStatus] = useState<{ isPro: boolean } | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    window.api.aiGetProviderModel().then((result: { provider: string; model: string; models: ProviderModels }) => {
      setProvider(result.provider)
      setModel(result.model)
      setModels(result.models)
    })

    // Load custom skills
    if (projectPath && typeof window.api.skillsLoad === "function") {
      window.api.skillsLoad(projectPath).then((raw) => {
        setCustomSkills((raw ?? []) as CustomSkill[])
      }).catch(() => {})
    }

    // Load telemetry and pro status
    window.api.telemetryIsEnabled().then((v: boolean) => setTelemetryEnabled(v)).catch(() => {})
    window.api.getProStatus().then((s: { isPro: boolean }) => setProStatus(s)).catch(() => {})
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 180)
  }

  const handleSetProvider = async (p: string) => {
    await window.api.aiSetProvider(p)
    const result = await window.api.aiGetProviderModel()
    setProvider(result.provider)
    setModel(result.model)
  }

  const handleSetModel = async (m: string) => {
    await window.api.aiSetModel(m)
    setModel(m)
  }

  const saveSkills = async (skills: CustomSkill[]) => {
    setCustomSkills(skills)
    if (projectPath && typeof window.api.skillsSave === "function") {
      await window.api.skillsSave(projectPath, skills).catch(() => {})
    }
  }

  const handleSaveSkill = (skill: CustomSkill) => {
    if (editingSkill === null) return
    const next = [...customSkills]
    if (editingSkill.index === -1) {
      next.push(skill)
    } else {
      next[editingSkill.index] = skill
    }
    saveSkills(next)
    setEditingSkill(null)
  }

  const handleDeleteSkill = (index: number) => {
    const next = customSkills.filter((_, i) => i !== index)
    saveSkills(next)
  }

  const currentModels = models[provider as keyof ProviderModels] ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: `rgba(5,8,15,${visible ? "0.75" : "0"})`,
        backdropFilter: visible ? "blur(8px)" : "none",
        transition: "all 0.18s ease"
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-[480px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05) inset",
          transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
          opacity: visible ? 1 : 0,
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
            {t("settings")}
          </span>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-100"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5 overflow-y-auto">
          {/* Language */}
          <div className="flex flex-col gap-2">
            <SectionLabel>{t("language")}</SectionLabel>
            <div className="flex gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className="px-4 py-1.5 rounded-lg text-xs transition-all duration-150"
                  style={{
                    background: language === lang.code ? "var(--accent)" : "var(--bg-elevated)",
                    color: language === lang.code ? "white" : "var(--text-secondary)",
                    border: `1px solid ${language === lang.code ? "transparent" : "var(--border)"}`,
                    fontWeight: language === lang.code ? 500 : 400
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Theme</SectionLabel>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="px-4 py-1.5 rounded-lg text-xs transition-all duration-150"
                  style={{
                    background: theme === t.id ? "var(--accent)" : "var(--bg-elevated)",
                    color: theme === t.id ? "white" : "var(--text-secondary)",
                    border: `1px solid ${theme === t.id ? "transparent" : "var(--border)"}`,
                    fontWeight: theme === t.id ? 500 : 400
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border-subtle)" }} />

          {/* AI Provider */}
          <div className="flex flex-col gap-2">
            <SectionLabel>AI Provider</SectionLabel>
            <div className="flex gap-2">
              {(["anthropic", "openai"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleSetProvider(p)}
                  className="px-4 py-1.5 rounded-lg text-xs transition-all duration-150"
                  style={{
                    background: provider === p ? "var(--accent)" : "var(--bg-elevated)",
                    color: provider === p ? "white" : "var(--text-secondary)",
                    border: `1px solid ${provider === p ? "transparent" : "var(--border)"}`,
                    fontWeight: provider === p ? 500 : 400
                  }}
                >
                  {p === "anthropic" ? "Anthropic" : "OpenAI"}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          {currentModels.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Model</SectionLabel>
              <select
                value={model}
                onChange={(e) => handleSetModel(e.target.value)}
                className="rounded-lg px-3 py-2 focus:outline-none transition-all duration-150"
                style={{
                  background: "var(--bg-base)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontSize: "12px"
                }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"}
              >
                {currentModels.map((m) => (
                  <option key={m.id} value={m.id} style={{ background: "var(--bg-panel)" }}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* API Keys */}
          {provider === "anthropic" && (
            <KeyField
              label="Claude API Key"
              placeholder="sk-ant-api03-\u2026"
              isSet={!!apiKey}
              onSave={async (key) => {
                await window.api.aiSetKey(key)
                setApiKey(key)
              }}
            />
          )}
          {provider === "openai" && (
            <KeyField
              label="OpenAI API Key"
              placeholder="sk-proj-\u2026"
              isSet={!!openaiKey}
              onSave={async (key) => {
                await window.api.aiSetOpenAIKey(key)
                setOpenAIKey(key)
              }}
            />
          )}

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border-subtle)" }} />

          {/* Skills */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <SectionLabel>Skills</SectionLabel>
              {projectPath && (
                <button
                  onClick={() => setEditingSkill({ index: -1, skill: { ...EMPTY_SKILL } })}
                  className="px-2 py-0.5 rounded-md text-xs transition-all duration-100"
                  style={{ color: "var(--accent)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"}
                >
                  + New
                </button>
              )}
            </div>

            {!projectPath && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Open a project to manage custom skills
              </span>
            )}

            {/* Existing custom skills */}
            {customSkills.map((skill, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
              >
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", fontFamily: "monospace", minWidth: 70 }}>
                  {skill.command}
                </span>
                <span className="flex-1" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {skill.label}
                </span>
                <button
                  onClick={() => setEditingSkill({ index: i, skill: { ...skill } })}
                  className="px-1.5 py-0.5 rounded text-xs transition-all duration-100"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteSkill(i)}
                  className="px-1.5 py-0.5 rounded text-xs transition-all duration-100"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
                >
                  Delete
                </button>
              </div>
            ))}

            {/* Skill editor */}
            {editingSkill && (
              <SkillEditor
                skill={editingSkill.skill}
                onSave={handleSaveSkill}
                onCancel={() => setEditingSkill(null)}
              />
            )}

            {customSkills.length === 0 && !editingSkill && projectPath && (
              <span style={{ fontSize: "11px", color: "var(--text-ghost)" }}>
                No custom skills yet. Type / in chat to see built-in skills.
              </span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border-subtle)" }} />

          {/* Telemetry */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Data</SectionLabel>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={telemetryEnabled}
                onChange={async (e) => {
                  const v = e.target.checked
                  setTelemetryEnabled(v)
                  await window.api.telemetrySetEnabled(v)
                }}
                className="accent-[var(--accent)]"
                style={{ width: 14, height: 14 }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Help improve Luano AI by collecting anonymous usage data
              </span>
            </label>
            <span style={{ fontSize: "10px", color: "var(--text-ghost)", lineHeight: 1.4 }}>
              Data is stored locally on your machine. Nothing is sent to any server.
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border-subtle)" }} />

          {/* Pro Status */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Plan</SectionLabel>
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
            >
              <span style={{ fontSize: "12px", fontWeight: 600, color: proStatus?.isPro ? "#10b981" : "var(--text-secondary)" }}>
                {proStatus?.isPro ? "Pro" : "Community (Free)"}
              </span>
              {!proStatus?.isPro && (
                <span style={{ fontSize: "10px", color: "var(--text-ghost)", marginLeft: "auto" }}>
                  Agent, Inline Edit, Studio Bridge require Pro
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <span style={{ fontSize: "10px", color: "var(--text-ghost)" }}>{t("version")}</span>
        </div>
      </div>
    </div>
  )
}
