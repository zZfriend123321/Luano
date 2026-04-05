/**
 * electron/pro/index.ts — Pro feature interface layer
 *
 * All features are unlocked during the testing period.
 * No paywall or subscription checks are enforced.
 */

import type { ChatMessage, AgentChatResult } from "../ai/provider"

export interface LuanoProModule {
  validateLicense(): boolean
  agentChat(messages: ChatMessage[], systemPrompt: string, streamChannel: string): Promise<AgentChatResult>
  inlineEdit(filePath: string, fileContent: string, instruction: string, systemPrompt: string): Promise<string>
  getTools(): unknown[]
  buildSystemPrompt(context: unknown): string
}

let pro: LuanoProModule | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pro = require("@luano/pro")
} catch {
  pro = null
}

export function isPro(): boolean {
  // All features unlocked during testing period
  return true
}

export function getProModule(): LuanoProModule | null {
  if (!isPro()) return null
  return pro
}

/** Feature gate — returns true if the feature should be available */
export function hasFeature(_feature: ProFeature): boolean {
  // All features unlocked during testing period
  return true
}

export type ProFeature =
  | "editor"
  | "lsp"
  | "rojo"
  | "selene"
  | "stylua"
  | "terminal"
  | "explorer"
  | "templates"
  | "basic-chat"
  | "agent"
  | "inline-edit"
  | "rag"
  | "studio-bridge"
  | "cross-script"
  | "perf-lint"
  | "datastore-schema"
  | "skills"
