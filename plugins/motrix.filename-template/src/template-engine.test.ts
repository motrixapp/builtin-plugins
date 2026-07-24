import { describe, expect, it } from 'vitest'
import { renderTemplate, renderTemplateDetailed } from './template-engine'

const BASE_CONTEXT = {
  taskId: 'task-123',
  filePath: '/downloads/Example File.zip',
  sourceUrl: 'https://www.example.com/releases/Example%20File.zip',
  createdBy: 'user' as const,
}

describe('filename template rendering', () => {
  it('renders a filename stem and preserves the original extension', () => {
    expect(renderTemplate('{{title}}', BASE_CONTEXT)).toBe('Example File.zip')
  })

  it('preserves a recognized compound extension', () => {
    expect(
      renderTemplate('{{title|slug}}', {
        ...BASE_CONTEXT,
        filePath: '/downloads/My Archive.tar.gz',
      })
    ).toBe('my-archive.tar.gz')
  })

  it('does not duplicate an extension already produced by the template', () => {
    expect(renderTemplate('{{title}}.{{ext}}', BASE_CONTEXT)).toBe(
      'Example File.zip'
    )
    expect(renderTemplate('{{original}}', BASE_CONTEXT)).toBe(
      'Example File.zip'
    )
  })

  it('handles extensionless files and dotfiles without adding a trailing dot', () => {
    expect(
      renderTemplate('{{title}}', {
        ...BASE_CONTEXT,
        filePath: '/downloads/README',
      })
    ).toBe('README')
    expect(
      renderTemplate('{{title}}', {
        ...BASE_CONTEXT,
        filePath: '/downloads/.env',
      })
    ).toBe('.env')
  })

  it('extracts basenames from Windows paths', () => {
    expect(
      renderTemplate('{{title|lower}}', {
        ...BASE_CONTEXT,
        filePath: String.raw`C:\Downloads\Report.PDF`,
      })
    ).toBe('report.PDF')
  })

  it('renders source, task, and creation variables', () => {
    expect(
      renderTemplate('{{domain}}-{{createdBy}}-{{id}}', BASE_CONTEXT)
    ).toBe('example.com-user-task-123.zip')
    expect(renderTemplate('{{urlPath}}', BASE_CONTEXT)).toBe(
      'releases_Example File.zip'
    )
  })

  it('formats the task request time in local time', () => {
    const requestedAt = new Date(2026, 6, 24, 15, 4, 5).getTime()
    expect(
      renderTemplate('{{date:YYYYMMDD}}-{{time:HH-mm-ss}}', {
        ...BASE_CONTEXT,
        requestedAt,
      })
    ).toBe('20260724-15-04-05.zip')
  })

  it('reads nested scalar metadata and supports defaults', () => {
    const context = {
      ...BASE_CONTEXT,
      metadata: {
        media: { artist: 'Björk', track: 7 },
        published: true,
      },
    }
    expect(
      renderTemplate(
        '{{meta.media.artist}}-{{meta.media.track|pad:2}}-{{meta.published}}',
        context
      )
    ).toBe('Björk-07-true.zip')
    expect(
      renderTemplate('{{meta.album|default:"Unknown Album"}}', context)
    ).toBe('Unknown Album.zip')
  })

  it('applies text filters in order', () => {
    expect(
      renderTemplate('{{title|trim|slug|upper|truncate:12}}', {
        ...BASE_CONTEXT,
        filePath: '/downloads/  Crème brûlée 中文  .txt',
      })
    ).toBe('CREME-BRULEE.txt')
    expect(
      renderTemplate('{{title|replace:" ":"_"|lower}}', BASE_CONTEXT)
    ).toBe('example_file.zip')
  })
})

describe('template diagnostics and portable filename safety', () => {
  it('reports unknown variables and filters as errors', () => {
    const variable = renderTemplateDetailed('{{missing}}', BASE_CONTEXT)
    expect(variable.valid).toBe(false)
    expect(variable.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'unknown_variable',
      })
    )

    const filter = renderTemplateDetailed('{{title|notAFilter}}', BASE_CONTEXT)
    expect(filter.valid).toBe(false)
    expect(filter.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'unknown_filter',
      })
    )
  })

  it('reports malformed expressions and filter arguments', () => {
    const unclosed = renderTemplateDetailed('{{title', BASE_CONTEXT)
    expect(unclosed.valid).toBe(false)
    expect(unclosed.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unclosed_expression' })
    )

    const badArgument = renderTemplateDetailed(
      '{{title|truncate:nope}}',
      BASE_CONTEXT
    )
    expect(badArgument.valid).toBe(false)
    expect(badArgument.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'invalid_filter_argument' })
    )

    const unclosedQuote = renderTemplateDetailed(
      '{{title|default:"fallback}}',
      BASE_CONTEXT
    )
    expect(unclosedQuote.valid).toBe(false)
    expect(unclosedQuote.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unclosed_quote' })
    )

    const extraArgument = renderTemplateDetailed(
      '{{title:unexpected|lower:unexpected}}',
      BASE_CONTEXT
    )
    expect(extraArgument.valid).toBe(false)
    expect(extraArgument.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_variable_argument' }),
        expect.objectContaining({ code: 'invalid_filter_argument' }),
      ])
    )
  })

  it('rejects templates longer than the configuration limit', () => {
    const result = renderTemplateDetailed('x'.repeat(513), BASE_CONTEXT)
    expect(result.valid).toBe(false)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'template_too_long' })
    )
  })

  it('does not treat braces originating in a variable as template syntax', () => {
    const result = renderTemplateDetailed('{{title}}', {
      ...BASE_CONTEXT,
      filePath: '/downloads/Literal {{ braces.zip',
    })
    expect(result.valid).toBe(true)
    expect(result.output).toBe('Literal {{ braces.zip')
  })

  it('warns when metadata is not scalar', () => {
    const result = renderTemplateDetailed('{{meta.media}}', {
      ...BASE_CONTEXT,
      metadata: { media: { artist: 'Example' } },
    })
    expect(result.valid).toBe(true)
    expect(result.output).toBe('Example File.zip')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        code: 'non_scalar_metadata',
      })
    )
  })

  it('replaces unsafe characters and rewrites Windows reserved names', () => {
    const unsafe = renderTemplateDetailed('bad/name:*?', BASE_CONTEXT)
    expect(unsafe.output).toBe('bad_name___.zip')
    expect(unsafe.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unsafe_characters_replaced' })
    )

    const reserved = renderTemplateDetailed('CON', BASE_CONTEXT)
    expect(reserved.output).toBe('_CON.zip')
    expect(reserved.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'reserved_name_rewritten' })
    )
  })

  it('falls back to the original title when the rendered stem is empty', () => {
    const result = renderTemplateDetailed('   ', BASE_CONTEXT)
    expect(result.output).toBe('Example File.zip')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'empty_output' })
    )
  })

  it('normalizes surrounding whitespace and trailing dots', () => {
    const result = renderTemplateDetailed('  Report...  ', BASE_CONTEXT)
    expect(result.output).toBe('Report.zip')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'filename_normalized' })
    )
  })

  it('truncates by UTF-8 bytes without cutting the protected extension', () => {
    const result = renderTemplateDetailed('界'.repeat(100), {
      ...BASE_CONTEXT,
      filePath: '/downloads/original.tar.gz',
    })
    expect(Buffer.byteLength(result.output, 'utf8')).toBeLessThanOrEqual(240)
    expect(result.output).toMatch(/\.tar\.gz$/)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'filename_truncated' })
    )
  })
})
