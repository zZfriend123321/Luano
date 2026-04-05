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
      const sidecar = spawnSidecar("argon", ["serve", "--host", "0.0.0.0"], {
        cwd: projectPath,
        onData: (data) => {
          this.restartCount = 0
          // Parse port from Argon output (e.g. "Argon is listening on 0.0.0.0:8000")
          const portMatch = data.match(/listening on.*:(\d{4,5})/i)
          if (portMatch) this.port = parseInt(portMatch[1], 10)
          if (this.status !== "running") {
            this.status = "running"
          }
          this.notifyStatus()
        },
        onError: () => {}
      })

      this.proc = sidecar.process

      this.proc.on("exit", (code) => {
        if (this.proc === null) return
        this.status = code === 0 ? "stopped" : "error"
        this.notifyStatus()
        if (code !== 0 && code !== null && this.projectPath && this.restartCount < 3) {
          this.restartCount++
          setTimeout(() => this.serve(this.projectPath!), 2000)
        }
      })

      this.proc.on("error", () => {
        this.status = "error"
        this.notifyStatus()
      })
    } catch {
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
