/** Extract file name from a full path (handles both / and \\ separators) */
export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}
