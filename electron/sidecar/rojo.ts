import { ChildProcess } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { spawnSidecar } from "./index"
import { BrowserWindow } from "electron"

export type RojoStatus = "stopped" | "starting" | "running" | "error"

export class RojoManager {
  private proc: ChildProcess | null = null
  private sourcemapProc: ChildProcess | null = null
  private status: RojoStatus = "stopped"
  private projectPath: string | null = null
  private restartCount = 0

  serve(projectPath: string): void {
    this.stop()
    this.projectPath = projectPath

    // default.project.json이 없으면 시작하지 않음
    if (!existsSync(join(projectPath, "default.project.json"))) {
      this.status = "stopped"
      this.notifyStatus()
      this.notifyLog("[info] No default.project.json found — Rojo not started")
      return
    }

    this.status = "starting"
    this.notifyStatus()

    try {
      const sidecar = spawnSidecar("rojo", ["serve", "default.project.json", "--address", "0.0.0.0"], {
        cwd: projectPath,
        onData: (data) => {
          this.restartCount = 0
          if (this.status !== "running") {
            this.status = "running"
          }
          this.notifyStatus()
          this.notifyLog(data)
          this.startSourcemapWatch(projectPath)
        },
        onError: (data) => {
          this.notifyLog(`[stderr] ${data}`)
        }
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

      this.proc.on("error", (err) => {
        this.status = "error"
        this.notifyStatus()
        this.notifyLog(`[error] Rojo process error: ${err.message}`)
      })
    } catch (err) {
      this.status = "error"
      this.notifyStatus()
      const msg = err instanceof Error ? err.message : String(err)
      this.notifyLog(`[error] Failed to start Rojo: ${msg}`)
    }
  }

  private startSourcemapWatch(projectPath: string): void {
    if (this.sourcemapProc) return

    const sidecar = spawnSidecar("rojo", ["sourcemap", "default.project.json", "--watch", "--output", "sourcemap.json"], {
      cwd: projectPath
    })
    this.sourcemapProc = sidecar.process
  }

  stop(): void {
    const proc = this.proc
    const sourcemapProc = this.sourcemapProc
    this.proc = null
    this.sourcemapProc = null
    this.projectPath = null

    if (proc && !proc.killed) proc.kill()
    if (sourcemapProc && !sourcemapProc.killed) sourcemapProc.kill()

    this.status = "stopped"
    this.notifyStatus()
  }

  getStatus(): RojoStatus {
    return this.status
  }

  private notifyStatus(): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("rojo:status-changed", this.status)
    })
  }

  private notifyLog(data: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("rojo:log", data)
    })
  }
}
