import type { ResolverDeps, ResolverResult } from './index'

export function match(_url: string): boolean {
  return true
}

export async function resolve(
  _url: string,
  _deps: ResolverDeps
): Promise<ResolverResult | null> {
  // Generic fallback: nothing to rewrite for plain HTTP(S) downloads. The
  // dispatcher returns null which leaves ctx.uris untouched.
  return null
}
