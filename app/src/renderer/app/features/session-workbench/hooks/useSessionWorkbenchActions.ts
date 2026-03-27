import type { Dispatch, SetStateAction } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import { buildAnnotationKey } from '@app/features/anchors'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import {
  renderAnnotatedImageDataUrl,
  serializeAnnotationDocument,
} from '@app/features/annotation/annotation-export'
import type { AnnotationInspectorItem, MarketAnchorStatus, MarketAnchorView } from '@app/features/anchors'
import type { ComposerSuggestion } from '@app/features/composer/types'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import type { WorkbenchTab } from '../session-workbench-types'
import {
  pickPreferredAnalysisProvider,
  toAnchorSemanticType,
  toDraftAnnotation,
} from '../modules/session-workbench-mappers'

type SessionWorkbenchActionDeps = {
  anchors: MarketAnchorView[]
  draftAnnotations: DraftAnnotation[]
  payload: SessionWorkbenchPayload | null
  realtimeDraft: string
  refreshSession: (nextSessionId?: string) => Promise<SessionWorkbenchPayload | null>
  reloadGroundings: (sessionPayload: SessionWorkbenchPayload, aiRunId?: string | null) => Promise<void>
  selectedEvent: EventRecord | null
  selectedScreenshot: ScreenshotRecord | null
  setActiveTab: Dispatch<SetStateAction<WorkbenchTab>>
  setBusy: Dispatch<SetStateAction<boolean>>
  setMessage: Dispatch<SetStateAction<string | null>>
  setSelectedEventId: Dispatch<SetStateAction<string | null>>
  setSelectedScreenshotId: Dispatch<SetStateAction<string | null>>
}

export const createSessionWorkbenchActions = ({
  anchors,
  draftAnnotations,
  payload,
  realtimeDraft,
  refreshSession,
  reloadGroundings,
  selectedEvent,
  selectedScreenshot,
  setActiveTab,
  setBusy,
  setMessage,
  setSelectedEventId,
  setSelectedScreenshotId,
}: SessionWorkbenchActionDeps) => {
  const handleImportScreenshot = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.capture.importImage({
        session_id: payload.current_context.session_id,
        contract_id: payload.current_context.contract_id,
        period_id: payload.current_context.period_id,
        trade_id: payload.current_context.trade_id,
        source_view: 'session-workbench',
        kind: payload.current_context.capture_kind,
      })
      await refreshSession(payload.session.id)
      setSelectedScreenshotId(result.screenshot.id)
      setMessage(`已导入截图：${result.screenshot.caption ?? result.screenshot.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? `导入失败：${error.message}` : '导入截图失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenSnipCapture = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.capture.openSnipCapture({
        session_id: payload.current_context.session_id,
        contract_id: payload.current_context.contract_id,
        period_id: payload.current_context.period_id,
        trade_id: payload.current_context.trade_id,
        source_view: 'session-workbench',
        kind: payload.current_context.capture_kind,
      })
      setMessage('截图浮层已打开。拖拽选区后可复制，或按 Enter 送入当前笔记流程。')
    } catch (error) {
      setMessage(error instanceof Error ? `打开失败：${error.message}` : '打开截图浮层失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveAnnotations = async() => {
    if (!selectedScreenshot || !payload) {
      return
    }

    try {
      setBusy(true)
      const annotatedImageDataUrl = await renderAnnotatedImageDataUrl({
        image_url: selectedScreenshot.raw_asset_url,
        source_width: selectedScreenshot.width,
        source_height: selectedScreenshot.height,
        annotations: draftAnnotations,
      })
      const annotationDocumentJson = serializeAnnotationDocument({
        screenshot_id: selectedScreenshot.id,
        source_width: selectedScreenshot.width,
        source_height: selectedScreenshot.height,
        annotations: draftAnnotations,
      })
      await alphaNexusApi.capture.saveAnnotations({
        screenshot_id: selectedScreenshot.id,
        annotations: draftAnnotations,
        annotated_image_data_url: annotatedImageDataUrl,
        annotation_document_json: annotationDocumentJson,
      })
      await refreshSession(payload.session.id)
      setMessage(`已保存 ${draftAnnotations.length} 个标注到当前上下文。`)
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRunAnalysis = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const providers = await alphaNexusApi.ai.listProviders()
      const preferredProvider = pickPreferredAnalysisProvider(providers)
      if (!preferredProvider) {
        throw new Error('当前没有已启用且已配置完成的 AI provider。请先到设置页启用并配置一个 provider。')
      }
      const result = await alphaNexusApi.ai.runAnalysis({
        session_id: payload.session.id,
        screenshot_id: selectedScreenshot?.id ?? null,
        provider: preferredProvider.provider,
        prompt_kind: 'market-analysis',
      })
      const nextPayload = await refreshSession(payload.session.id)
      if (nextPayload) {
        await reloadGroundings(nextPayload, result.ai_run.id)
      }
      setSelectedEventId(result.event.id)
      if (result.event.screenshot_id) {
        setSelectedScreenshotId(result.event.screenshot_id)
      }
      setActiveTab('ai')
      setMessage(`${preferredProvider.label} 分析已完成：${result.analysis_card.summary_short}`)
    } catch (error) {
      setMessage(error instanceof Error ? `运行失败：${error.message}` : '运行 AI 分析失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async() => {
    if (!payload) {
      return
    }

    try {
      const result = await alphaNexusApi.export.sessionMarkdown({ session_id: payload.session.id })
      setMessage(`Markdown 已导出到 ${result.file_path}`)
    } catch (error) {
      setMessage(error instanceof Error ? `导出失败：${error.message}` : '导出 Markdown 失败。')
    }
  }

  const handleSaveRealtimeView = async() => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.workbench.saveRealtimeView({
        session_id: payload.session.id,
        trade_id: payload.current_context.trade_id ?? null,
        content_md: realtimeDraft,
      })
      await refreshSession(payload.session.id)
      setActiveTab('view')
      setMessage(payload.current_context.trade_id
        ? '已将我的看法保存到当前 Trade 上下文。'
        : '已将我的看法保存到本地 Session 上下文。')
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存我的看法失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateNoteBlock = async(input?: {
    title?: string
    content_md?: string
  }) => {
    if (!payload) {
      return null
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.createNoteBlock({
        session_id: payload.current_context.session_id,
        trade_id: payload.current_context.trade_id ?? null,
        title: input?.title ?? '用户笔记',
        content_md: input?.content_md ?? '',
      })
      await refreshSession(payload.session.id)
      setMessage(payload.current_context.trade_id
        ? '已在当前 Trade 上下文中新建笔记块。'
        : '已在当前 Session 上下文中新建笔记块。')
      return result.block
    } catch (error) {
      setMessage(error instanceof Error ? `创建失败：${error.message}` : '创建笔记块失败。')
      return null
    } finally {
      setBusy(false)
    }
  }

  const handleComposerSuggestionAccept = async(suggestion: ComposerSuggestion) => {
    if (!payload) {
      return
    }

    try {
      await alphaNexusApi.workbench.applySuggestionAction({
        suggestion_id: suggestion.id,
        suggestion_kind: 'composer',
        action: 'keep',
      })
      setMessage(`已记录候选采纳：${suggestion.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `记录采纳失败：${error.message}` : '记录 Composer 候选采纳失败。')
    }
  }

  const handleUpdateNoteBlock = async(input: {
    block_id: string
    title: string
    content_md: string
  }) => {
    if (!payload) {
      return null
    }

    const result = await alphaNexusApi.workbench.updateNoteBlock(input)
    await refreshSession(payload.session.id)
    return result.block
  }

  const handleAnnotationSuggestionAction = async(
    suggestionId: string,
    action: 'keep' | 'merge' | 'discard',
  ) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.applySuggestionAction({
        suggestion_id: suggestionId,
        suggestion_kind: 'annotation',
        action,
      })
      if (result.screenshot_id) {
        setSelectedScreenshotId(result.screenshot_id)
      }
      await refreshSession(payload.session.id)
      setMessage(
        result.applied_effect === 'merged-annotation'
          ? 'AI annotation suggestion 已合并到现有正式标注。'
          : result.applied_effect === 'created-annotation'
            ? 'AI annotation suggestion 已转成正式标注。'
            : 'AI annotation suggestion 已丢弃并记录审计。',
      )
    } catch (error) {
      setMessage(error instanceof Error ? `处理失败：${error.message}` : '处理 annotation suggestion 失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteScreenshot = async(screenshotId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.deleteScreenshot({ screenshot_id: screenshotId })
      await refreshSession(payload.session.id)
      setSelectedScreenshotId((current) => current === screenshotId ? null : current)
      if (selectedEvent?.screenshot_id === screenshotId) {
        setSelectedEventId(null)
      }
      setMessage(`已删除截图：${result.screenshot.caption ?? result.screenshot.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : '删除截图失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreScreenshot = async(screenshotId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.restoreScreenshot({ screenshot_id: screenshotId })
      await refreshSession(payload.session.id)
      setSelectedScreenshotId(result.screenshot.id)
      if (result.screenshot.event_id) {
        setSelectedEventId(result.screenshot.event_id)
      }
      setMessage(`已恢复截图：${result.screenshot.caption ?? result.screenshot.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : '恢复截图失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteAnnotation = async(annotationId: string) => {
    if (!payload || !selectedScreenshot) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.deleteAnnotation({ annotation_id: annotationId })
      await refreshSession(payload.session.id)
      setSelectedScreenshotId(selectedScreenshot.id)
      setMessage(`已删除标注：${result.annotation.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : '删除标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreAnnotation = async(annotationId: string) => {
    if (!payload || !selectedScreenshot) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.restoreAnnotation({ annotation_id: annotationId })
      await refreshSession(payload.session.id)
      setSelectedScreenshotId(selectedScreenshot.id)
      setMessage(`已恢复标注：${result.annotation.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : '恢复标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateAnnotation = async(input: {
    annotation_id: string
    label: string
    title: string
    semantic_type: AnnotationRecord['semantic_type']
    text: string | null
    note_md: string
    add_to_memory: boolean
  }) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.updateAnnotation({
        annotation_id: input.annotation_id,
        label: input.label,
        title: input.title,
        semantic_type: input.semantic_type,
        text: input.text,
        note_md: input.note_md,
        add_to_memory: input.add_to_memory,
      })
      await refreshSession(payload.session.id)
      setSelectedScreenshotId(result.annotation.screenshot_id)
      setMessage(result.annotation.add_to_memory
        ? `已更新标注并加入记忆候选：${result.annotation.title}。`
        : `已更新标注：${result.annotation.title}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `标注更新失败：${error.message}` : '更新标注失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteAiRecord = async(aiRunId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.deleteAiRecord({ ai_run_id: aiRunId })
      await refreshSession(payload.session.id)
      if (selectedEvent?.ai_run_id === aiRunId) {
        setSelectedEventId(null)
      }
      setActiveTab('view')
      setMessage(`已删除 AI 记录：${result.ai_record.analysis_card?.summary_short ?? result.ai_record.ai_run.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : '删除 AI 记录失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreAiRecord = async(aiRunId: string) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      const result = await alphaNexusApi.workbench.restoreAiRecord({ ai_run_id: aiRunId })
      await refreshSession(payload.session.id)
      if (result.ai_record.event) {
        setSelectedEventId(result.ai_record.event.id)
        if (result.ai_record.event.screenshot_id) {
          setSelectedScreenshotId(result.ai_record.event.screenshot_id)
        }
      }
      setActiveTab('ai')
      setMessage(`已恢复 AI 记录：${result.ai_record.analysis_card?.summary_short ?? result.ai_record.ai_run.id}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : '恢复 AI 记录失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteBlock = async(block: ContentBlockRecord) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      if (block.block_type === 'ai-summary') {
        const aiRunId = payload.events.find((event) => event.id === block.event_id)?.ai_run_id
        if (!aiRunId) {
          throw new Error('当前 AI 内容块没有关联 ai_run_id。')
        }
        await alphaNexusApi.workbench.deleteAiRecord({ ai_run_id: aiRunId })
        await refreshSession(payload.session.id)
        setMessage(`已删除 AI 记录“${block.title}”。`)
        return
      }
      await alphaNexusApi.workbench.deleteContentBlock({ block_id: block.id })
      await refreshSession(payload.session.id)
      setMessage(`已删除内容块“${block.title}”。`)
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : `删除“${block.title}”失败。`)
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreBlock = async(block: ContentBlockRecord) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      if (block.block_type === 'ai-summary') {
        const aiRunId = payload.deleted_ai_records.find((record) => record.content_block?.id === block.id)?.ai_run.id
        if (!aiRunId) {
          throw new Error('当前 AI 内容块没有可恢复的 ai_run_id。')
        }
        await alphaNexusApi.workbench.restoreAiRecord({ ai_run_id: aiRunId })
        await refreshSession(payload.session.id)
        setMessage(`已恢复 AI 记录“${block.title}”。`)
        return
      }
      await alphaNexusApi.workbench.restoreContentBlock({ block_id: block.id })
      await refreshSession(payload.session.id)
      setMessage(`已恢复内容块“${block.title}”。`)
    } catch (error) {
      setMessage(error instanceof Error ? `恢复失败：${error.message}` : `恢复“${block.title}”失败。`)
    } finally {
      setBusy(false)
    }
  }

  const handleAdoptAnchorFromAnnotation = (item: AnnotationInspectorItem) => {
    if (!payload) {
      return
    }

    void (async() => {
      try {
        setBusy(true)
        const sourceAnnotation = selectedScreenshot?.annotations.find((annotation) =>
          buildAnnotationKey(toDraftAnnotation(annotation)) === item.key)
        const existing = anchors.find((anchor) => anchor.source_annotation_key === item.key || anchor.source_annotation_id === sourceAnnotation?.id)
        await alphaNexusApi.workbench.adoptAnchor({
          contract_id: payload.contract.id,
          session_id: payload.session.id,
          trade_id: payload.current_context.trade_id ?? null,
          source_annotation_id: sourceAnnotation?.id ?? null,
          source_annotation_label: item.label,
          source_screenshot_id: selectedScreenshot?.id ?? null,
          title: `${item.label} Anchor`,
          semantic_type: toAnchorSemanticType(item.annotation.shape),
          carry_forward: true,
          thesis_md: '',
          invalidation_rule_md: '',
        })
        await refreshSession(payload.session.id)
        setMessage(existing ? `已重新激活 ${item.label} 对应的 Anchor。` : `已将 ${item.label} 采纳为 Anchor。`)
      } catch (error) {
        setMessage(error instanceof Error ? `采纳失败：${error.message}` : '采纳 Anchor 失败。')
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleSetAnchorStatus = (anchorId: string, status: MarketAnchorStatus) => {
    if (!payload) {
      return
    }

    void (async() => {
      try {
        setBusy(true)
        await alphaNexusApi.workbench.updateAnchorStatus({
          anchor_id: anchorId,
          status,
        })
        await refreshSession(payload.session.id)
        const target = anchors.find((anchor) => anchor.id === anchorId)
        if (target) {
          setMessage(`Anchor ${target.title} 已更新为 ${status}。`)
        }
      } catch (error) {
        setMessage(error instanceof Error ? `更新失败：${error.message}` : '更新 Anchor 状态失败。')
      } finally {
        setBusy(false)
      }
    })()
  }

  return {
    handleAdoptAnchorFromAnnotation,
    handleAnnotationSuggestionAction,
    handleComposerSuggestionAccept,
    handleDeleteAiRecord,
    handleDeleteAnnotation,
    handleDeleteBlock,
    handleDeleteScreenshot,
    handleExport,
    handleCreateNoteBlock,
    handleImportScreenshot,
    handleOpenSnipCapture,
    handleRestoreAiRecord,
    handleRestoreAnnotation,
    handleRestoreBlock,
    handleRestoreScreenshot,
    handleRunAnalysis,
    handleSaveAnnotations,
    handleSaveRealtimeView,
    handleSetAnchorStatus,
    handleUpdateAnnotation,
    handleUpdateNoteBlock,
  }
}
