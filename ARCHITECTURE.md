# Luano Architecture

## 1. Product Vision

Luano는 Roblox 개발자를 위한 올인원 AI 바이브코딩 에디터.
앱 열고, 말로 시키면, AI가 Luau 코드 작성 → Rojo로 Studio 동기화 → 에러 읽고 자동 수정.
Zero setup: 모든 도구(Rojo, Selene, StyLua, luau-lsp)가 앱 안에 번들링.

---

## 2. License

- **Public repo (luano)** — Apache 2.0. 에디터, 툴체인, UI
- **Private repo (@luano/pro)** — 독점 라이선스. AI Agent, Studio Bridge, 분석 도구

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 31 |
| Frontend | React 19 + TypeScript |
| Editor | Monaco Editor + monaco-languageclient |
| Bundler | Vite 5 (electron-vite) |
| State | Zustand (persist) |
| Styling | Tailwind CSS + Radix UI |
| Terminal | xterm.js + node-pty |
| LSP | luau-lsp (stdio ↔ WebSocket bridge, port 6008) |
| AI | Claude API (primary), OpenAI (secondary), @anthropic-ai/sdk |
| RAG | better-sqlite3 + FTS5 |
| Sidecar | Rojo, Selene, StyLua, luau-lsp (resources/binaries/{win,mac,linux}/) |

---

## 4. Project Structure

```
luano/
├── electron/                    # Electron main process (Node.js)
│   ├── main.ts                  # BrowserWindow 생성, 앱 라이프사이클
│   ├── preload.ts               # contextBridge IPC API 노출
│   ├── store.ts                 # electron-store 기반 설정 저장
│   ├── pro/
│   │   └── index.ts             # @luano/pro 인터페이스 레이어 (Free/Pro 분리)
│   ├── sidecar/
│   │   ├── index.ts             # spawnSidecar() 공통 헬퍼
│   │   ├── rojo.ts              # Rojo serve/build/sourcemap
│   │   ├── selene.ts            # Selene 린터
│   │   └── stylua.ts            # StyLua 포매터
│   ├── lsp/
│   │   ├── manager.ts           # luau-lsp 스폰 + WebSocket 브릿지
│   │   └── bridge.ts            # stdio ↔ WebSocket 변환
│   ├── ai/
│   │   ├── provider.ts          # Claude/OpenAI API, Agent loop (양쪽 다 tool use 지원)
│   │   ├── context.ts           # 3-레이어 컨텍스트 빌더 + topology/sourcemap 주입
│   │   ├── tools.ts             # AI 도구 12개 (lint_file 포함)
│   │   └── rag.ts               # FTS5 docs 검색
│   ├── file/
│   │   ├── project.ts           # 프로젝트 열기/생성
│   │   └── watcher.ts           # chokidar 파일 감시 (300ms debounce)
│   ├── ipc/
│   │   └── handlers.ts          # ipcMain.handle() 등록, Pro feature gating
│   ├── bridge/
│   │   └── server.ts            # Studio 실시간 HTTP polling 브릿지
│   ├── mcp/
│   │   └── client.ts            # Studio MCP 클라이언트 (legacy)
│   ├── topology/
│   │   └── analyzer.ts          # sourcemap.json 파싱 + 의존성 그래프
│   ├── analysis/
│   │   ├── cross-script.ts      # 스크립트 간 참조 분석
│   │   └── performance-lint.ts  # 성능 안티패턴 감지
│   ├── datastore/
│   │   └── schema.ts            # DataStore 스키마 생성/마이그레이션
│   └── telemetry/
│       └── collector.ts         # 로컬 SQLite 텔레메트리 (opt-in)
│
├── src/                         # Renderer process (React)
│   ├── App.tsx
│   ├── editor/
│   │   ├── EditorPane.tsx
│   │   ├── LuauLanguageClient.ts
│   │   ├── LuauTokensProvider.ts
│   │   ├── LuauTheme.ts
│   │   └── EditorActions.ts
│   ├── ai/
│   │   ├── ChatPanel.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── DiffView.tsx
│   │   ├── InlineEditOverlay.tsx
│   │   ├── CodeBlock.tsx
│   │   └── useAIChat.ts
│   ├── explorer/
│   ├── terminal/
│   ├── rojo/
│   ├── studio/
│   ├── topology/
│   ├── components/
│   ├── stores/
│   ├── hooks/
│   ├── lib/
│   └── i18n/
│
├── resources/
│   ├── binaries/{win,mac,linux}/
│   ├── roblox-docs/roblox_docs.db
│   ├── type-defs/globalTypes.d.luau
│   ├── studio-plugin/LuanoPlugin.lua
│   └── templates/{empty,obby,tycoon}/
│
├── packages/doc-indexer/
├── scripts/download-binaries.ts
└── .github/workflows/
    ├── ci.yml
    └── build.yml                # 3-platform build + auto GitHub Release
```

---

## 5. Core Systems

### 5.1 LSP Bridge

```
Monaco (renderer) ↔ WebSocket (port 6008) ↔ Node.js main ↔ luau-lsp stdio
```

- luau-lsp flags: `--definitions=globalTypes.d.luau --sourcemap=sourcemap.json`
- 크래시 시 자동 재시작
- 기능: autocomplete, diagnostics, hover, go-to-def, rename, inlay hints

### 5.2 Sidecar Binary Management

모든 바이너리는 `spawnSidecar()` 헬퍼로 관리. 크래시 시 지수 백오프 재시작.

- **Rojo**: 프로젝트 열면 자동 serve + sourcemap watch
- **StyLua**: 파일 변경 시 자동 포맷
- **Selene**: 파일 변경 시 자동 린트 (300ms debounce)
- **luau-lsp**: 프로젝트 열면 자동 시작

### 5.3 AI System

**Agent Loop (Anthropic + OpenAI 양쪽 지원)**:
- Anthropic: `messages.stream()` + `tool_use` stop reason
- OpenAI: `chat.completions.create()` + function calling
- 동일한 tool set, 동일한 MAX_ROUNDS (15), 동일한 abort/retry 로직

**Agent-First tool_choice**:
- 기본: tool 사용 강제 (`any` / `required`)
- 순수 질문(`?`, `뭐야`, `explain` 등)만 `auto`로 전환

**AI 도구 12개**:
`read_file`, `edit_file`, `create_file`, `delete_file`, `list_files`, `grep_files`, `search_docs`, `lint_file`, `read_instance_tree`, `get_runtime_logs`, `run_studio_script`, `set_property`

**Explore-first 워크플로우**:
1. EXPLORE: `list_files`, `read_file`, `grep_files`로 프로젝트 이해
2. ACT: `create_file`, `edit_file`로 수정
3. VERIFY: `lint_file`로 검증 → 에러 시 자동 수정 루프

**3-레이어 컨텍스트**:
1. Global Summary (~500 tokens): 프로젝트 구조 + 모듈 exports + topology 의존성 + sourcemap instance map
2. Local Context: 현재 파일 + diagnostics + 첨부 파일
3. On-Demand RAG: Roblox 문서 FTS5 검색

### 5.4 Studio Bridge

HTTP polling 기반. Roblox Studio 플러그인(`LuanoPlugin.lua`)이 주기적으로 Luano에 요청.

- Instance tree 읽기
- Console 로그/에러 수집
- Luau 스크립트 원격 실행
- 인스턴스 프로퍼티 수정

AI 시스템 프롬프트에 Studio Testing Loop 포함: 코드 수정 → 자동 테스트 → 에러 감지 → 자동 수정.

### 5.5 Topology Analyzer

`sourcemap.json` + 소스 코드 정적 분석으로:
- `require()` 의존성 그래프 생성
- `RemoteEvent` fire/receive 관계 추출
- 결과를 UI 시각화 + AI 컨텍스트에 주입

---

## 6. Community vs Pro

| 기능 | Community (Free) | Pro |
|------|:-:|:-:|
| Monaco + Luau LSP | O | O |
| Rojo, Selene, StyLua | O | O |
| File explorer, Terminal | O | O |
| Project templates | O | O |
| AI Chat (BYOK, Q&A) | O | O |
| AI Agent mode | - | O |
| Inline AI Edit (Cmd+K) | - | O |
| Roblox Docs RAG | - | O |
| Studio Live Bridge | - | O |
| Cross-script analysis | - | O |
| Performance lint | - | O |
| DataStore schema generator | - | O |

Pro 기능은 `electron/pro/index.ts`에서 `@luano/pro` 패키지 존재 여부로 게이팅.

---

## 7. Security

| 위협 | 대응 |
|---|---|
| API 키 저장 | electron-store (향후 OS keychain) |
| AI에 코드 노출 | Privacy mode 토글 |
| Studio Bridge | 명시적 플러그인 설치, localhost only |
| Sidecar 무결성 | 다운로드 시 파일 크기 검증 |
| Electron 보안 | contextIsolation: true, nodeIntegration: false, CSP |

---

## 8. Build & CI

```bash
npm run dev        # electron-vite dev (HMR)
npm run build      # electron-vite build
npm run package    # electron-builder (NSIS/DMG/AppImage)
```

GitHub Actions (`build.yml`):
- Windows, macOS, Linux 매트릭스 빌드
- `v*` 태그 푸시 시 자동 GitHub Release 생성
- 바이너리 자동 다운로드 (`scripts/download-binaries.ts`)
