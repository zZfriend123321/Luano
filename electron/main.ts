import { app, BrowserWindow, shell } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { registerIpcHandlers } from "./ipc/handlers"
import { RojoManager } from "./sidecar/rojo"
import { LspManager } from "./lsp/manager"
// Pro module — bridge server (dynamic)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
let bridgeServer: { startBridgeServer: () => void; setBridgeWindow: (w: any) => void } | null = null
try { bridgeServer = require("./bridge/server") } catch {}

let mainWindow: BrowserWindow | null = null

export const rojoManager = new RojoManager()
export const lspManager = new LspManager()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show()
    bridgeServer?.setBridgeWindow(mainWindow!)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("io.luano.app")

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  bridgeServer?.startBridgeServer()
  registerIpcHandlers()
  createWindow()

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", async () => {
  rojoManager.stop()
  await lspManager.stop()
  if (process.platform !== "darwin") app.quit()
})
