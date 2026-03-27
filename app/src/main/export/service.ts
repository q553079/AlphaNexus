import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { loadTradeDetail } from '@main/db/repositories/workbench-repository'
import { getSessionWorkbench } from '@main/domain/workbench-service'
import { buildSessionMarkdown } from '@main/export/markdown'
import { ExportSessionMarkdownInputSchema, SessionMarkdownExportSchema } from '@shared/export/contracts'

export const exportSessionMarkdown = async(paths: LocalFirstPaths, rawInput: unknown) => {
  const input = ExportSessionMarkdownInputSchema.parse(rawInput)
  const payload = await getSessionWorkbench(paths, { session_id: input.session_id })
  const db = await getDatabase(paths)
  const tradeDetails = payload.trades.map((trade) => loadTradeDetail(db, trade.id))
  const markdown = buildSessionMarkdown({
    payload,
    tradeDetails,
  })
  const outputPath = path.join(paths.exportsDir, `${payload.session.id}.md`)

  await writeFile(outputPath, markdown, 'utf8')

  return SessionMarkdownExportSchema.parse({
    file_path: outputPath,
    markdown,
  })
}
