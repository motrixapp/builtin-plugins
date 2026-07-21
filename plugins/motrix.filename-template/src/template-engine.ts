// biome-ignore lint/suspicious/noControlCharactersInRegex: filename sanitization
const SANITIZE_RE = /[/\\<>:"|?*\x00-\x1f]/g
const MAX_LEN = 200

export interface TemplateCtx {
  taskId: string
  filePath: string
}

export function renderTemplate(tpl: string, ctx: TemplateCtx): string {
  const base = ctx.filePath.split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  const title = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot + 1) : ''
  const date = new Date().toISOString().slice(0, 10)
  const out = tpl
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{ext\}\}/g, ext)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{id\}\}/g, ctx.taskId)
  return out.replace(SANITIZE_RE, '_').slice(0, MAX_LEN)
}
