import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { store } from "../store"
import { BrowserWindow } from "electron"
import { TOOLS, executeTool } from "./tools"

export type Provider = "anthropic" | "openai"

export const MODELS: Record<Provider, Array<{ id: string; label: string }>> = {
  anthropic: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "o1", label: "o1" },
    { id: "o1-mini", label: "o1 mini" }
  ]
}

// ── 상태 ────────────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null
let openaiClient: OpenAI | null = null
let activeAbortController: AbortController | null = null

function getProvider(): Provider {
  return (store.get("provider") as Provider | undefined) ?? "anthropic"
}

function getModel(): string {
  const provider = getProvider()
  const stored = store.get("model") as string | undefined
  if (stored) return stored
  return MODELS[provider][0].id
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = store.get("apiKey") as string | undefined
    if (!apiKey) throw new Error("Anthropic API key not set")
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = store.get("openaiKey") as string | undefined
    if (!apiKey) throw new Error("OpenAI API key not set")
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// ── 설정 API ─────────────────────────────────────────────────────────────────

export function setApiKey(key: string): void {
  store.set("apiKey", key)
  anthropicClient = null
}

export function getApiKey(): string | undefined {
  return store.get("apiKey") as string | undefined
}

export function setOpenAIKey(key: string): void {
  store.set("openaiKey", key)
  openaiClient = null
}

export function getOpenAIKey(): string | undefined {
  return store.get("openaiKey") as string | undefined
}

export function setProvider(provider: Provider): void {
  store.set("provider", provider)
  // 해당 프로바이더의 첫 번째 모델로 초기화
  store.set("model", MODELS[provider][0].id)
}

export function setModel(model: string): void {
  store.set("model", model)
}

export function getProviderAndModel(): { provider: Provider; model: string } {
  return { provider: getProvider(), model: getModel() }
}

// ── Abort 지원 ──────────────────────────────────────────────────────────────

export function abortAgent(): void {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

// ── 타임아웃 유틸 ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms = 30_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout (${ms / 1000}s)`)), ms)
    )
  ])
}

// ── 공통 메시지 타입 ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// ── 기본 채팅 ────────────────────────────────────────────────────────────────

export async function chat(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const provider = getProvider()
  const model = getModel()

  if (provider === "openai") {
    const response = await withTimeout(getOpenAIClient().chat.completions.create({
      model,
      max_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, ...messages]
    }))
    return response.choices[0]?.message?.content ?? ""
  }

  const response = await withTimeout(getAnthropicClient().messages.create({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages
  }))
  return response.content[0].type === "text" ? response.content[0].text : ""
}

// ── 스트리밍 채팅 ─────────────────────────────────────────────────────────────

export async function chatStream(
  messages: ChatMessage[],
  systemPrompt: string,
  streamChannel: string
): Promise<void> {
  const provider = getProvider()
  const model = getModel()

  const send = (text: string | null) => {
    BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(streamChannel, text))
  }
  const sendError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send(streamChannel, `\n\nError: ${msg}`)
    )
    send(null)
  }

  try {
    if (provider === "openai") {
      const stream = await getOpenAIClient().chat.completions.create({
        model,
        max_tokens: 8192,
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages]
      })
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content
        if (text) send(text)
      }
      send(null)
      return
    }

    const stream = getAnthropicClient().messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages
    })
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        send((chunk.delta as { type: "text_delta"; text: string }).text)
      }
    }
    send(null)
  } catch (err) {
    sendError(err)
  }
}

// ── Plan Chat ─────────────────────────────────────────────────────────────────

export async function planChat(messages: ChatMessage[], systemPrompt: string): Promise<string[]> {
  const planPrompt = `${systemPrompt}

PLAN MODE: Before executing anything, output ONLY a JSON array of steps you will take to fulfill the user's request. Do not write any code or modify files yet.
Format strictly: ["Step 1: description", "Step 2: description", ...]
Output ONLY the JSON array — no explanation, no markdown fences.`

  let text = ""
  try {
    text = await chat(messages, planPrompt)
  } catch {
    return ["Unable to generate plan — check API key or connection"]
  }

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return [text.trim().slice(0, 300)]
  try {
    const parsed = JSON.parse(match[0])
    if (Array.isArray(parsed)) return parsed.map(String).slice(0, 12)
  } catch {}
  return [text.trim().slice(0, 300)]
}

// ── Inline Edit ───────────────────────────────────────────────────────────────

export async function inlineEdit(
  filePath: string,
  fileContent: string,
  instruction: string,
  systemPrompt: string
): Promise<string> {
  const provider = getProvider()
  const model = getModel()

  const userMsg = `FILE: ${filePath}\n\n\`\`\`luau\n${fileContent}\n\`\`\`\n\nINSTRUCTION: ${instruction}`
  const system = `${systemPrompt}\n\nINLINE EDIT MODE: Return ONLY the complete modified file — no explanation, no markdown fences, no commentary. Raw Luau code only.`

  let text = ""

  if (provider === "openai") {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      max_tokens: 8192,
      messages: [{ role: "system", content: system }, { role: "user", content: userMsg }]
    })
    text = response.choices[0]?.message?.content ?? fileContent
  } else {
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: userMsg }]
    })
    text = response.content[0].type === "text" ? response.content[0].text : fileContent
  }

  return text.replace(/^```(?:lua|luau)?\r?\n/m, "").replace(/\r?\n```$/m, "").trim()
}

// ── Agent 헬퍼 ──────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // 보수적 추정: 영어 ~4자/토큰, 한국어 ~2자/토큰, 평균 ~3
  return Math.ceil(text.length / 3)
}

function estimateHistoryTokens(history: Anthropic.MessageParam[]): number {
  let total = 0
  for (const msg of history) {
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content)
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        total += estimateTokens(JSON.stringify(block))
      }
    }
  }
  return total
}

/** 토큰 예산 내로 히스토리 축소 — 가장 오래된 메시지부터 제거 */
function truncateHistory(
  history: Anthropic.MessageParam[],
  systemTokens: number,
  maxBudget = 150_000
): void {
  const budget = maxBudget - systemTokens - 8192
  while (estimateHistoryTokens(history) > budget && history.length > 2) {
    history.shift()
    // 히스토리는 항상 user 메시지로 시작해야 함
    while (history.length > 0 && history[0].role !== "user") {
      history.shift()
    }
  }
}

/** 유저 메시지가 코드 작성/수정 등 액션 요청인지 판별 */
function shouldForceToolUse(text: string): boolean {
  const t = text.trim()
  if (t.length < 5) return false
  // 질문은 tool 강제 X
  if (/[?？]\s*$/.test(t)) return false
  if (/^(what|why|how|when|where|who|which|explain|describe|tell me|is |are |can |does |do |did )/i.test(t)) return false
  if (/(뭐야|뭔가|뭐지|뭘까|왜|어때|인가요|인지|일까)\s*$/.test(t)) return false
  // 액션 키워드가 있으면 tool 강제
  return /만들|추가|수정|생성|삭제|변경|고쳐|작성|구현|create|make|add|fix|edit|write|implement|build|delete|remove|update|change|refactor/i.test(t)
}

// ── Agent Chat (스트리밍 + 도구 사용 + 중단 + 재시도) ──────────────────────

export interface AgentChatResult {
  modifiedFiles: string[]
}

export async function agentChat(
  messages: ChatMessage[],
  systemPrompt: string,
  streamChannel: string
): Promise<AgentChatResult> {
  const provider = getProvider()

  if (provider === "openai") {
    await chatStream(messages, systemPrompt, streamChannel)
    return { modifiedFiles: [] }
  }

  const model = getModel()
  const modifiedFiles: string[] = []
  const controller = new AbortController()
  activeAbortController = controller
  const MAX_ROUNDS = 15

  const send = (text: string | null) => {
    BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(streamChannel, text))
  }

  const history: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content
  }))

  // 스마트 tool_choice: 액션 요청이면 첫 라운드에서 도구 강제
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

  // 토큰 예산 초과 시 오래된 히스토리 제거
  const systemTokens = estimateTokens(systemPrompt)
  truncateHistory(history, systemTokens)

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (controller.signal.aborted) break

      // 프론트엔드에 현재 라운드 알림
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send(`${streamChannel}:round`, { round: round + 1, max: MAX_ROUNDS })
      )

      const toolChoice: Anthropic.MessageCreateParams["tool_choice"] =
        round === 0 && shouldForceToolUse(lastUserMsg)
          ? { type: "any" }
          : { type: "auto" }

      // 스트리밍 API + 재시도
      let response: Anthropic.Message | undefined
      let retries = 0

      while (true) {
        try {
          const stream = getAnthropicClient().messages.stream(
            {
              model,
              max_tokens: 8192,
              system: systemPrompt,
              tools: TOOLS,
              tool_choice: toolChoice,
              messages: history
            },
            { signal: controller.signal }
          )

          // 실시간 텍스트 스트리밍
          for await (const event of stream) {
            if (controller.signal.aborted) { stream.abort(); break }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send((event.delta as { type: "text_delta"; text: string }).text)
            }
          }

          if (!controller.signal.aborted) {
            response = await stream.finalMessage()
          }
          break
        } catch (err) {
          if (controller.signal.aborted) throw err
          const msg = err instanceof Error ? err.message : String(err)
          if (/overloaded|rate.?limit|529|500/i.test(msg) && retries < 2) {
            retries++
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)))
            continue
          }
          throw err
        }
      }

      if (controller.signal.aborted || !response) break
      if (response.stop_reason === "end_turn") break

      if (response.stop_reason === "tool_use") {
        history.push({ role: "assistant", content: response.content })
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== "tool_use") continue
          if (controller.signal.aborted) break

          try {
            const result = await executeTool(block.name, block.input as Record<string, unknown>)
            if (result.filePath) modifiedFiles.push(result.filePath)

            BrowserWindow.getAllWindows().forEach((win) => {
              win.webContents.send(`${streamChannel}:tool`, {
                tool: block.name,
                input: block.input,
                output: result.output,
                success: result.success
              })
            })

            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result.output })
          } catch (toolErr) {
            const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr)
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Tool error: ${errMsg}`,
              is_error: true
            })
          }
        }

        history.push({ role: "user", content: toolResults })
      } else {
        break
      }
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      const msg = err instanceof Error ? err.message : String(err)
      send(`\n\nAgent error: ${msg}`)
    }
  } finally {
    activeAbortController = null
  }

  send(null)
  return { modifiedFiles }
}
