import { DiffEditor } from "@monaco-editor/react"
import type * as Monaco from "monaco-editor"

interface DiffViewProps {
  original: string
  modified: string
}

function defineTheme(monaco: typeof Monaco): void {
  monaco.editor.defineTheme("luano-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment",    foreground: "565f89", fontStyle: "italic" },
      { token: "keyword",    foreground: "9d7cd8" },
      { token: "string",     foreground: "9ece6a" },
      { token: "number",     foreground: "ff9e64" },
      { token: "identifier", foreground: "c0caf5" }
    ],
    colors: {
      "editor.background":                   "#1a1b26",
      "editor.foreground":                   "#c0caf5",
      "editor.lineHighlightBackground":      "#1f2133",
      "editor.selectionBackground":          "#33467c50",
      "editorCursor.foreground":             "#7aa2f7",
      "editorLineNumber.foreground":         "#3b3f5c",
      "editorLineNumber.activeForeground":   "#737aa2",
      "diffEditor.insertedTextBackground":   "#73daca22",
      "diffEditor.removedTextBackground":    "#f7768e22",
      "diffEditor.insertedLineBackground":   "#73daca12",
      "diffEditor.removedLineBackground":    "#f7768e12",
      "diffEditorGutter.insertedLineBackground": "#73daca30",
      "diffEditorGutter.removedLineBackground":  "#f7768e30",
      "scrollbarSlider.background":          "#363854a0",
      "scrollbarSlider.hoverBackground":     "#474a6ba0"
    }
  })
}

export function DiffView({ original, modified }: DiffViewProps): JSX.Element {
  return (
    <DiffEditor
      height="100%"
      language="lua"
      theme="luano-dark"
      original={original}
      modified={modified}
      beforeMount={defineTheme}
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        padding: { top: 10 },
        lineHeight: 22
      }}
    />
  )
}
