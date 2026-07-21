import {
  type BeforeFinalizeContext,
  commands,
  config,
  hooks,
  lifecycle,
  log,
} from 'motrix:plugin-api'
import { renderTemplate } from './template-engine'

const DEFAULT_TEMPLATE = '{{title}}.{{ext}}'

async function readTemplate(): Promise<string> {
  const v = await config.get<string>('template')
  return v && v.length > 0 ? v : DEFAULT_TEMPLATE
}

hooks.beforeFinalize(
  async (ctx: BeforeFinalizeContext): Promise<BeforeFinalizeContext> => {
    const tpl = await readTemplate()
    const oldName = ctx.filePath.split('/').pop() ?? ''
    const newName = renderTemplate(tpl, {
      taskId: ctx.task.id,
      filePath: ctx.filePath,
    })
    if (!newName || newName === oldName) return ctx
    const newPath = `${ctx.task.saveDir}/${newName}`
    log.info('renaming via template', { tpl, oldName, newName })
    ctx.update({ filePath: newPath })
    return ctx
  }
)

commands.register('motrix.filename-template.applyTemplate', async (raw) => {
  const args = raw as unknown as {
    template: string
    filePath: string
    taskId: string
  }
  return renderTemplate(args.template, {
    taskId: args.taskId,
    filePath: args.filePath,
  })
})

lifecycle.onDeactivate(async () => {
  log.info('shutting down filename-template')
})
