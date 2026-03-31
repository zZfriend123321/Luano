import { existsSync } from "fs"
import { dirname, join } from "path"
import { spawnSidecar } from "./index"

export interface SelEneDiagnostic {
  file: string
  line: number
  col: number
  severity: "error" | "warning" | "info"
  message: string
  code: string
}

/** Walk up from startDir to find the directory containing selene.toml */
function findSeleneRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "selene.toml"))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return startDir
}

export async function lintFile(filePath: string, projectRoot?: string): Promise<SelEneDiagnostic[]> {
  const cwd = findSeleneRoot(projectRoot ?? dirname(filePath))

  return new Promise((resolve) => {
    const output: string[] = []

    const sidecar = spawnSidecar("selene", ["--display-style=json2", filePath], {
      cwd,
      onData: (data) => output.push(data),
      onError: (data) => output.push(data)
    })

    sidecar.process.on("exit", () => {
      try {
        const raw = output.join("")
        const diags: SelEneDiagnostic[] = []
        for (const line of raw.split("\n")) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            diags.push({
              file: filePath,
              line: parsed.primary_label?.span?.start_line ?? 1,
              col: parsed.primary_label?.span?.start_column ?? 1,
              severity: parsed.severity === "Error" ? "error" : "warning",
              message: parsed.message ?? "",
              code: parsed.code ?? ""
            })
          } catch {}
        }
        resolve(diags)
      } catch {
        resolve([])
      }
    })
  })
}
