import { ChildProcess, exec } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { spawnSidecar } from "./index"
import { BrowserWindow } from "electron"

export type RojoStatus = "stopped" | "starting" | "listening" | "serving" | "error"

export class RojoManager {
  private proc: ChildProcess | null = null
  private sourcemapProc: ChildProcess | null = null
  private status: RojoStatus = "stopped"
  private projectPath: string | null = null
  private restartCount = 0
  private connectionTimer: ReturnType<typeof setInterval> | null = null
  private rojoPort: number | null = null

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
          if (this.status !== "listening" && this.status !== "serving") {
            this.status = "listening"
          }
          // Rojo 출력에서 포트 파싱 → TCP 연결 감시 시작
          if (!this.rojoPort) {
            const m = data.match(/(?:port|localhost:|address.*:)\s*(\d{4,5})/i)
            if (m) {
              this.rojoPort = parseInt(m[1], 10)
              this.startConnectionCheck()
            }
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
        // this.proc이 null이면 stop()이 의도적으로 호출된 것 — 무시
        if (this.proc === null) return
        this.status = code === 0 ? "stopped" : "error"
        this.notifyStatus()
        // 비정상 종료 시 최대 3번까지 재시작
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

  /** Rojo 포트에 ESTABLISHED TCP 연결이 있는지 확인 → Studio 연결 감지 */
  private startConnectionCheck(): void {
    if (this.connectionTimer || !this.rojoPort) return
    // 즉시 한 번 체크 + 5초 간격 반복
    this.checkTcpConnections()
    this.connectionTimer = setInterval(() => this.checkTcpConnections(), 5000)
  }

  private checkTcpConnections(): void {
    if (!this.rojoPort || (this.status !== "listening" && this.status !== "serving")) {
      this.stopConnectionCheck()
      return
    }
    const port = this.rojoPort
    const cmd =
      process.platform === "win32"
        ? `netstat -an -p TCP | findstr ":${port}" | findstr "ESTABLISHED"`
        : `netstat -an 2>/dev/null | grep ":${port}" | grep "ESTABLISHED"`

    exec(cmd, { timeout: 3000 }, (_err, stdout) => {
      if (this.status !== "listening" && this.status !== "serving") return
      const hasConnection = stdout.trim().length > 0
      const newStatus: RojoStatus = hasConnection ? "serving" : "listening"
      if (newStatus !== this.status) {
        this.status = newStatus
        this.notifyStatus()
      }
    })
  }

  private stopConnectionCheck(): void {
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer)
      this.connectionTimer = null
    }
    this.rojoPort = null
  }

  private startSourcemapWatch(projectPath: string): void {
    if (this.sourcemapProc) return

    const sidecar = spawnSidecar("rojo", ["sourcemap", "default.project.json", "--watch", "--output", "sourcemap.json"], {
      cwd: projectPath
    })
    this.sourcemapProc = sidecar.process
  }

  stop(): void {
    this.stopConnectionCheck()
    // null로 먼저 해제해서 exit 이벤트 핸들러가 재시작/error 처리 안 하도록
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
