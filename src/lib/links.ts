/** Only treat http(s) URLs as safe to render as a clickable link, to avoid javascript: or other unsafe schemes. */
export function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    return undefined
  }
  return undefined
}
