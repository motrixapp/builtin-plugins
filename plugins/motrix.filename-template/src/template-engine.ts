const MAX_FILENAME_BYTES = 240
const MAX_EXTENSION_LENGTH = 24
const MAX_TEMPLATE_LENGTH = 512

// biome-ignore lint/complexity/useRegexLiterals: constructor avoids treating intentional ranges as source control characters
const UNSAFE_FILENAME_RE = new RegExp(
  '[/\\\\<>:"|?*\\x00-\\x1f\\x7f\\u202a-\\u202e\\u2066-\\u2069]',
  'g'
)
const WINDOWS_RESERVED_RE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const TOKEN_RE = /\{\{([\s\S]*?)\}\}/g
const COMPOUND_EXTENSIONS = [
  '.tar.gz',
  '.tar.bz2',
  '.tar.xz',
  '.tar.zst',
  '.tar.lz',
  '.tar.lzma',
  '.user.js',
  '.min.js',
  '.min.css',
  '.d.ts',
  '.d.mts',
  '.d.cts',
] as const

export type DiagnosticSeverity = 'error' | 'warning'

export interface TemplateDiagnostic {
  severity: DiagnosticSeverity
  code: string
  message: string
  expression?: string
}

export interface TemplateCtx {
  taskId: string
  filePath: string
  sourceUrl?: string
  requestedAt?: number
  createdBy?: 'user' | 'protocol' | 'api'
  metadata?: Record<string, unknown>
}

export interface TemplateResult {
  output: string
  valid: boolean
  diagnostics: TemplateDiagnostic[]
}

interface OriginalName {
  filename: string
  title: string
  extension: string
}

interface ExpressionPart {
  name: string
  args: string[]
}

function portableBasename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? ''
}

function splitOriginalName(filePath: string): OriginalName {
  const filename = portableBasename(filePath)
  const lower = filename.toLowerCase()
  const compound = COMPOUND_EXTENSIONS.find((candidate) =>
    lower.endsWith(candidate)
  )

  if (compound && filename.length > compound.length) {
    return {
      filename,
      title: filename.slice(0, -compound.length),
      extension: filename.slice(-compound.length),
    }
  }

  const dot = filename.lastIndexOf('.')
  const extensionLength = filename.length - dot - 1
  if (
    dot > 0 &&
    extensionLength > 0 &&
    extensionLength <= MAX_EXTENSION_LENGTH
  ) {
    return {
      filename,
      title: filename.slice(0, dot),
      extension: filename.slice(dot),
    }
  }

  return { filename, title: filename, extension: '' }
}

function splitOutsideQuotes(input: string, delimiter: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote = ''
  let escaped = false

  for (const char of input) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      current += char
      escaped = true
      continue
    }
    if (quote) {
      current += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === delimiter) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  parts.push(current.trim())
  return parts
}

function hasUnclosedQuote(input: string): boolean {
  let quote = ''
  let escaped = false
  for (const char of input) {
    if (escaped) {
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    }
  }
  return quote.length > 0
}

function unquote(value: string): string {
  const trimmed = value.trim()
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  const content =
    trimmed.length >= 2 && (first === '"' || first === "'") && last === first
      ? trimmed.slice(1, -1)
      : trimmed

  let out = ''
  let escaped = false
  for (const char of content) {
    if (escaped) {
      out += char === 'n' ? '\n' : char === 't' ? '\t' : char
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else {
      out += char
    }
  }
  return escaped ? `${out}\\` : out
}

function parseExpressionPart(raw: string): ExpressionPart {
  const [name = '', ...args] = splitOutsideQuotes(raw, ':')
  return {
    name: name.trim(),
    args: args.map(unquote),
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDate(timestamp: number, pattern: string): string {
  const date = new Date(timestamp)
  const values: Record<string, string> = {
    YYYY: String(date.getFullYear()).padStart(4, '0'),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  }
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => values[token] ?? '')
}

function urlParts(sourceUrl: string | undefined): {
  host: string
  domain: string
  urlPath: string
} {
  if (!sourceUrl) return { host: '', domain: '', urlPath: '' }
  try {
    const parsed = new URL(sourceUrl)
    const host = parsed.hostname
    let urlPath = parsed.pathname
    try {
      urlPath = decodeURIComponent(urlPath)
    } catch {}
    return {
      host,
      domain: host.replace(/^www\./i, ''),
      urlPath: urlPath.replace(/^\/+/, ''),
    }
  } catch {
    return { host: '', domain: '', urlPath: '' }
  }
}

function metadataValue(
  metadata: Record<string, unknown> | undefined,
  path: string
): unknown {
  let value: unknown = metadata
  for (const segment of path.split('.')) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.keys(value).includes(segment)
    ) {
      return undefined
    }
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function scalarToString(
  value: unknown,
  expression: string,
  diagnostics: TemplateDiagnostic[]
): string {
  if (value === undefined || value === null) return ''
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  diagnostics.push({
    severity: 'warning',
    code: 'non_scalar_metadata',
    message: `Metadata in "{{${expression}}}" is not a string, number, or boolean.`,
    expression,
  })
  return ''
}

function resolveVariable(
  part: ExpressionPart,
  expression: string,
  ctx: TemplateCtx,
  original: OriginalName,
  diagnostics: TemplateDiagnostic[]
): string {
  const timestamp =
    typeof ctx.requestedAt === 'number' &&
    Number.isFinite(ctx.requestedAt) &&
    !Number.isNaN(new Date(ctx.requestedAt).getTime())
      ? ctx.requestedAt
      : Date.now()
  const source = urlParts(ctx.sourceUrl)
  const format = part.args.join(':')

  if (part.name !== 'date' && part.name !== 'time' && part.args.length > 0) {
    diagnostics.push({
      severity: 'error',
      code: 'invalid_variable_argument',
      message: `Variable "${part.name}" in "{{${expression}}}" does not accept arguments.`,
      expression,
    })
  }

  switch (part.name) {
    case 'title':
      return original.title
    case 'original':
      return original.filename
    case 'ext':
      return original.extension.replace(/^\./, '')
    case 'id':
      return ctx.taskId
    case 'date':
      return formatDate(timestamp, format || 'YYYY-MM-DD')
    case 'time':
      return formatDate(timestamp, format || 'HH-mm-ss')
    case 'host':
      return source.host
    case 'domain':
      return source.domain
    case 'urlPath':
      return source.urlPath
    case 'createdBy':
      return ctx.createdBy ?? ''
    default:
      if (part.name.startsWith('meta.') && part.name.length > 5) {
        return scalarToString(
          metadataValue(ctx.metadata, part.name.slice(5)),
          expression,
          diagnostics
        )
      }
      diagnostics.push({
        severity: 'error',
        code: 'unknown_variable',
        message: `Unknown template variable "{{${part.name}}}".`,
        expression,
      })
      return ''
  }
}

function truncateCharacters(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('')
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function positiveInteger(
  raw: string | undefined,
  filter: string,
  expression: string,
  diagnostics: TemplateDiagnostic[]
): number | undefined {
  const value = Number(raw)
  if (Number.isInteger(value) && value > 0) return value
  diagnostics.push({
    severity: 'error',
    code: 'invalid_filter_argument',
    message: `Filter "${filter}" in "{{${expression}}}" needs a positive integer.`,
    expression,
  })
  return undefined
}

function hasArgumentCount(
  part: ExpressionPart,
  expected: number,
  expression: string,
  diagnostics: TemplateDiagnostic[]
): boolean {
  if (part.args.length === expected) return true
  diagnostics.push({
    severity: 'error',
    code: 'invalid_filter_argument',
    message: `Filter "${part.name}" in "{{${expression}}}" needs ${expected} argument${expected === 1 ? '' : 's'}.`,
    expression,
  })
  return false
}

function applyFilter(
  value: string,
  part: ExpressionPart,
  expression: string,
  diagnostics: TemplateDiagnostic[]
): string {
  switch (part.name) {
    case 'trim':
      if (!hasArgumentCount(part, 0, expression, diagnostics)) return value
      return value.trim()
    case 'lower':
      if (!hasArgumentCount(part, 0, expression, diagnostics)) return value
      return value.toLowerCase()
    case 'upper':
      if (!hasArgumentCount(part, 0, expression, diagnostics)) return value
      return value.toUpperCase()
    case 'slug':
      if (!hasArgumentCount(part, 0, expression, diagnostics)) return value
      return slugify(value)
    case 'truncate': {
      if (!hasArgumentCount(part, 1, expression, diagnostics)) return value
      const max = positiveInteger(
        part.args[0],
        part.name,
        expression,
        diagnostics
      )
      return max ? truncateCharacters(value, max) : value
    }
    case 'pad': {
      if (!hasArgumentCount(part, 1, expression, diagnostics)) return value
      const length = positiveInteger(
        part.args[0],
        part.name,
        expression,
        diagnostics
      )
      return length ? value.padStart(length, '0') : value
    }
    case 'default':
      if (!hasArgumentCount(part, 1, expression, diagnostics)) return value
      return value.trim().length > 0 ? value : (part.args[0] ?? '')
    case 'replace': {
      if (!hasArgumentCount(part, 2, expression, diagnostics)) return value
      const search = part.args[0] ?? ''
      return value.split(search).join(part.args[1] ?? '')
    }
    default:
      diagnostics.push({
        severity: 'error',
        code: 'unknown_filter',
        message: `Unknown template filter "${part.name}" in "{{${expression}}}".`,
        expression,
      })
      return value
  }
}

function renderExpression(
  raw: string,
  ctx: TemplateCtx,
  original: OriginalName,
  diagnostics: TemplateDiagnostic[]
): string {
  const expression = raw.trim()
  if (hasUnclosedQuote(expression)) {
    diagnostics.push({
      severity: 'error',
      code: 'unclosed_quote',
      message: `Template expression "{{${expression}}}" contains an unclosed quote.`,
      expression,
    })
    return ''
  }
  const parts = splitOutsideQuotes(expression, '|').map(parseExpressionPart)
  const variable = parts[0]
  if (!variable?.name) {
    diagnostics.push({
      severity: 'error',
      code: 'empty_expression',
      message: 'Template expressions cannot be empty.',
      expression,
    })
    return ''
  }

  let value = resolveVariable(variable, expression, ctx, original, diagnostics)
  for (const filter of parts.slice(1)) {
    value = applyFilter(value, filter, expression, diagnostics)
  }
  return value
}

function utf8Bytes(value: string): number {
  let bytes = 0
  for (const char of value) {
    const point = char.codePointAt(0) ?? 0
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4
  }
  return bytes
}

function truncateUtf8(value: string, maxBytes: number): string {
  let out = ''
  let bytes = 0
  for (const char of value) {
    const size = utf8Bytes(char)
    if (bytes + size > maxBytes) break
    out += char
    bytes += size
  }
  return out
}

function sanitizeStem(
  value: string,
  fallback: string,
  diagnostics: TemplateDiagnostic[]
): string {
  const normalized = value.normalize('NFC')
  const replaced = normalized.replace(UNSAFE_FILENAME_RE, '_')
  let stem = replaced.trim().replace(/[ .]+$/g, '')

  if (replaced !== normalized) {
    diagnostics.push({
      severity: 'warning',
      code: 'unsafe_characters_replaced',
      message:
        'Characters that are unsafe in portable filenames were replaced.',
    })
  }
  if (stem !== replaced && stem.length > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'filename_normalized',
      message: 'Surrounding whitespace or trailing dots were removed.',
    })
  }

  if (!stem || stem === '.' || stem === '..') {
    stem =
      fallback
        .normalize('NFC')
        .replace(UNSAFE_FILENAME_RE, '_')
        .trim()
        .replace(/[ .]+$/g, '') || 'download'
    diagnostics.push({
      severity: 'warning',
      code: 'empty_output',
      message:
        'The template produced an empty name; the original title was used.',
    })
  }

  if (WINDOWS_RESERVED_RE.test(stem)) {
    stem = `_${stem}`
    diagnostics.push({
      severity: 'warning',
      code: 'reserved_name_rewritten',
      message: 'A Windows reserved filename was prefixed with an underscore.',
    })
  }
  return stem
}

function sanitizeExtension(extension: string): string {
  return extension
    .normalize('NFC')
    .replace(UNSAFE_FILENAME_RE, '_')
    .replace(/[ .]+$/g, '')
}

function finishFilename(
  rendered: string,
  original: OriginalName,
  diagnostics: TemplateDiagnostic[]
): string {
  let stem = sanitizeStem(rendered, original.title, diagnostics)
  const extension = sanitizeExtension(original.extension)
  const alreadyHasExtension =
    extension.length > 0 && stem.toLowerCase().endsWith(extension.toLowerCase())
  if (alreadyHasExtension) {
    stem = stem.slice(0, -extension.length).replace(/[ .]+$/g, '')
    if (!stem) stem = sanitizeStem('', original.title, diagnostics)
  }
  const available = Math.max(1, MAX_FILENAME_BYTES - utf8Bytes(extension))

  if (utf8Bytes(stem) > available) {
    stem = truncateUtf8(stem, available).replace(/[ .]+$/g, '') || 'download'
    diagnostics.push({
      severity: 'warning',
      code: 'filename_truncated',
      message: `The filename was truncated to ${MAX_FILENAME_BYTES} UTF-8 bytes.`,
    })
  }
  return `${stem}${extension}`
}

export function renderTemplateDetailed(
  template: string,
  ctx: TemplateCtx
): TemplateResult {
  const diagnostics: TemplateDiagnostic[] = []
  const original = splitOriginalName(ctx.filePath)
  const source = template.slice(0, MAX_TEMPLATE_LENGTH)

  if (template.length > MAX_TEMPLATE_LENGTH) {
    diagnostics.push({
      severity: 'error',
      code: 'template_too_long',
      message: `The template exceeds the ${MAX_TEMPLATE_LENGTH}-character limit.`,
    })
  }

  const unmatched = source.replace(TOKEN_RE, '')
  TOKEN_RE.lastIndex = 0
  if (unmatched.includes('{{') || unmatched.includes('}}')) {
    diagnostics.push({
      severity: 'error',
      code: 'unclosed_expression',
      message: 'The template contains an unclosed expression.',
    })
  }

  const output = source.replace(TOKEN_RE, (_match, raw: string) =>
    renderExpression(raw, ctx, original, diagnostics)
  )

  TOKEN_RE.lastIndex = 0
  const filename = finishFilename(output, original, diagnostics)
  return {
    output: filename,
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    diagnostics,
  }
}

export function renderTemplate(template: string, ctx: TemplateCtx): string {
  return renderTemplateDetailed(template, ctx).output
}
