import {
  type BeforeFinalizeContext,
  commands,
  config,
  hooks,
  lifecycle,
  log,
} from 'motrix:plugin-api'
import { renderTemplateDetailed, type TemplateCtx } from './template-engine'

const DEFAULT_TEMPLATE = '{{title}}'

interface PreviewArgs {
  template?: unknown
  filePath?: unknown
  taskId?: unknown
  sourceUrl?: unknown
  requestedAt?: unknown
  createdBy?: unknown
  metadata?: unknown
}

async function readTemplate(): Promise<string> {
  const value = await config.get<string>('template')
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : DEFAULT_TEMPLATE
}

function portableBasename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? ''
}

function joinTaskPath(saveDir: string, filename: string): string {
  if (/[/\\]$/.test(saveDir)) return `${saveDir}${filename}`
  const separator =
    saveDir.includes('\\') && !saveDir.includes('/') ? '\\' : '/'
  return `${saveDir}${separator}${filename}`
}

function isCreatedBy(
  value: unknown
): value is NonNullable<TemplateCtx['createdBy']> {
  return value === 'user' || value === 'protocol' || value === 'api'
}

function previewContext(raw: PreviewArgs): TemplateCtx {
  const metadata =
    raw.metadata &&
    typeof raw.metadata === 'object' &&
    !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : undefined
  return {
    taskId: typeof raw.taskId === 'string' ? raw.taskId : 'preview-task',
    filePath:
      typeof raw.filePath === 'string' ? raw.filePath : 'example-file.zip',
    sourceUrl:
      typeof raw.sourceUrl === 'string'
        ? raw.sourceUrl
        : 'https://example.com/downloads/example-file.zip',
    requestedAt:
      typeof raw.requestedAt === 'number' ? raw.requestedAt : Date.now(),
    createdBy: isCreatedBy(raw.createdBy) ? raw.createdBy : 'user',
    metadata,
  }
}

hooks.beforeFinalize(
  async (ctx: BeforeFinalizeContext): Promise<BeforeFinalizeContext> => {
    const template = await readTemplate()
    const result = renderTemplateDetailed(template, {
      taskId: ctx.task.id,
      filePath: ctx.filePath,
      sourceUrl: ctx.sourceUrl,
      requestedAt: ctx.requestedAt,
      createdBy: ctx.createdBy,
      metadata: ctx.metadata.getAll(),
    })

    if (!result.valid) {
      log.warn('filename template is invalid; keeping original filename', {
        template,
        diagnostics: result.diagnostics,
      })
      return ctx
    }

    const oldName = portableBasename(ctx.filePath)
    if (!result.output || result.output === oldName) return ctx

    log.info('renaming via filename template', {
      template,
      oldName,
      newName: result.output,
      diagnostics: result.diagnostics,
    })
    ctx.update({ filePath: joinTaskPath(ctx.task.saveDir, result.output) })
    return ctx
  }
)

commands.register('motrix.filename-template.preview', async (raw) => {
  const args = raw as PreviewArgs
  const template =
    typeof args?.template === 'string' && args.template.trim().length > 0
      ? args.template
      : DEFAULT_TEMPLATE
  const result = renderTemplateDetailed(template, previewContext(args ?? {}))
  return {
    output: result.output,
    valid: result.valid,
    diagnostics: result.diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
      expression: diagnostic.expression ?? '',
    })),
  }
})

lifecycle.onDeactivate(async () => {
  log.info('shutting down filename-template')
})
