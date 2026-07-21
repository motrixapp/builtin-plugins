const ARCHIVE_LINK_RE =
  /<a[^>]+href="([^"]+\.(?:zip|tar\.gz|tgz|rar|7z|exe|dmg|iso|pkg))"/i

export function findArchiveLink(html: string, baseUrl: string): string | null {
  const match = ARCHIVE_LINK_RE.exec(html)
  if (!match?.[1]) return null
  try {
    return new URL(match[1], baseUrl).toString()
  } catch {
    return null
  }
}
