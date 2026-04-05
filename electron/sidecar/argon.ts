import { ChildProcess } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { spawnSidecar } from "./index"
import { BrowserWindow } from "electron"

export type ArgonStatus = "stopped" | "starting" | "running" | "error"

export class ArgonManager {
  private proc: ChildProcess | null = null
  private status: ArgonStatus = "stopped"
  private projectPath: string | null = null
  private port: number | null = null
  private restartCount = 0

  serve(projectPath: string): void {
    this.stop()
    this.projectPath = projectPath

    // Argon uses default.project.json (same as Rojo)
    if (!existsSync(join(projectPath, "default.project.json"))) {
      this.status = "stopped"
      this.notifyStatus()
      return
    }

    this.status = "starting"
    this.notifyStatus()

    try {
      const handleOutput = (data: string): void => {
        console.log("[Argon stdout]", data.trim())
        // Parse port from Argon output (e.g. "Argon is listening on 0.0.0.0:8000")
        const portMatch = data.match(/listening on.*:(\d{4,5})/i)
        if (portMatch) {
          this.port = parseInt(portMatch[1], 10)
          this.restartCount = 0
          this.status = "running"
          this.notifyStatus()
        }
      }

      const handleError = (data: string): void => {
        // Argon (Rust CLI) writes status/log output to stderr via the tracing crate
        console.error("[Argon stderr]", data.trim())

        // Forward to output handler to detect port
        handleOutput(data)

        // Detect error conditions from tracing output
        const lower = data.toLowerCase()
        if (lower.includes("error") || lower.includes("failed") || lower.includes("panicked")) {
          if (this.status === "starting") {
            this.status = "error"
            this.notifyStatus()
          }
        }
      }

      const sidecar = spawnSidecar("argon", ["serve", "default.project.json", "--host", "0.0.0.0"], {
        cwd: projectPath,
        onData: handleOutput,
        onError: handleError
      })

      this.proc = sidecar.process

      this.proc.on("exit", (code) => {
        console.log(`[Argon] Process exited with code ${code}`)
        if (this.proc === null) return
        this.status = code === 0 ? "stopped" : "error"
        this.notifyStatus()
        if (code !== 0 && code !== null && this.projectPath && this.restartCount < 3) {
          this.restartCount++
          setTimeout(() => this.serve(this.projectPath!), 2000)
        }
      })

      this.proc.on("error", (err) => {
        console.error("[Argon] Failed to start process:", err.message)
        this.status = "error"
        this.notifyStatus()
      })
    } catch (err) {
      console.error("[Argon] Exception during serve:", err)
      this.status = "error"
      this.notifyStatus()
    }
  }

  stop(): void {
    const proc = this.proc
    this.proc = null
    this.projectPath = null

    if (proc && !proc.killed) proc.kill()

    this.status = "stopped"
    this.notifyStatus()
  }

  getStatus(): ArgonStatus {
    return this.status
  }

  getPort(): number | null {
    return this.port
  }

  private notifyStatus(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("argon:status-changed", this.status, this.port)
    })
  }

}
