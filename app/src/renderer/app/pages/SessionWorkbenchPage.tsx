import { useNavigate, useParams } from 'react-router-dom'
import { SessionAiComposerDrawer } from '@app/features/session-workbench/SessionAiComposerDrawer'
import { SessionAiDock } from '@app/features/session-workbench/SessionAiDock'
import { SessionCanvasColumn } from '@app/features/session-workbench/SessionCanvasColumn'
import { SessionEventColumn } from '@app/features/session-workbench/SessionEventColumn'
import { SessionWorkbenchHeader } from '@app/features/session-workbench/SessionWorkbenchHeader'
import { SessionWorkspaceColumn } from '@app/features/session-workbench/SessionWorkspaceColumn'
import { useSessionWorkbench } from '@app/features/session-workbench/useSessionWorkbench'

export const SessionWorkbenchPage = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const workbench = useSessionWorkbench(sessionId)

  return workbench.payload ? (
    <section className="session-workbench">
      <SessionWorkbenchHeader
        busy={workbench.busy}
        onExport={() => {
          void workbench.handleExport()
        }}
        onRunAnalysis={() => {
          void workbench.handleRunAnalysis()
        }}
        onSelectTarget={(option) => {
          if (option.target_kind === 'period') {
            void navigate(`/periods/${option.period_id}`)
            return
          }
          if (option.session_id !== workbench.payload?.session.id) {
            if (option.target_kind === 'trade' && option.trade_id) {
              void navigate(`/trades/${option.trade_id}`)
              return
            }
            void navigate(`/sessions/${option.session_id}`)
            return
          }
          void workbench.handleSetCurrentContext(option)
        }}
        payload={workbench.payload}
      />

      {workbench.message ? <div className="status-inline session-workbench__status">{workbench.message}</div> : null}

      <div className="session-workbench__layout">
        <SessionEventColumn
          activeReviewCaseId={workbench.activeReviewCase?.id ?? null}
          busy={workbench.busy}
          currentTrade={workbench.currentTrade}
          eventSelection={workbench.eventSelection}
          events={workbench.payload.events}
          onAddSelectionToAnalysisTray={workbench.addSelectionToAnalysisTray}
          onClearSelection={workbench.clearEventSelection}
          onOpenReviewCase={(reviewCaseId) => {
            void workbench.handleOpenReviewCase(reviewCaseId)
          }}
          onOpenTrade={(tradeId) => {
            void navigate(`/trades/${tradeId}`)
          }}
          onSaveSelectionAsReviewCase={() => {
            void workbench.handleSaveReviewCase()
          }}
          onSelectEvent={workbench.selectEvent}
          onTogglePinnedEvent={workbench.togglePinnedEvent}
          reviewCases={workbench.reviewCases}
          sessionCreatedAt={workbench.payload.session.created_at}
          screenshots={workbench.payload.screenshots}
          selectedEventIds={workbench.selectedEventIds}
          trades={workbench.payload.trades}
        />
        <SessionCanvasColumn
          activeContentBlocks={workbench.activeContentBlocks}
          activeAnnotations={workbench.selectedScreenshotAnnotations}
          adoptedAnnotationKeys={workbench.adoptedAnnotationKeys}
          analysisTray={workbench.analysisTray}
          analysisTrayCompareScreenshot={workbench.analysisTrayCompareScreenshot}
          analysisTrayPrimaryScreenshot={workbench.analysisTrayPrimaryScreenshot}
          analysisTrayScreenshots={workbench.analysisTrayScreenshots}
          annotationInspectorItems={workbench.annotationInspectorItems}
          annotationSuggestions={workbench.annotationSuggestions}
          busy={workbench.busy}
          currentTrade={workbench.currentTrade}
          deletedAnnotations={workbench.deletedAnnotations}
          deletedContentBlocks={workbench.deletedContentBlocks}
          deletedScreenshots={workbench.deletedScreenshots}
          draftAnnotations={workbench.draftAnnotations}
          onAddScreenshotToAnalysisTray={workbench.addScreenshotToAnalysisTray}
          onClearAnalysisTray={workbench.clearAnalysisTray}
          onCreateNoteBlock={(input) => workbench.handleCreateNoteBlock(input)}
          onAdoptAnchor={workbench.handleAdoptAnchorFromAnnotation}
          onAnnotationSuggestionAction={(suggestionId, action) => {
            void workbench.handleAnnotationSuggestionAction(suggestionId, action)
          }}
          onDeleteAiRecord={(aiRunId) => {
            void workbench.handleDeleteAiRecord(aiRunId)
          }}
          onDeleteAnnotation={(annotationId) => {
            void workbench.handleDeleteAnnotation(annotationId)
          }}
          onDeleteBlock={(block) => {
            void workbench.handleDeleteBlock(block)
          }}
          onMoveContentBlock={(block, option) => {
            void workbench.handleMoveContentBlock(block, option)
          }}
          onMoveScreenshot={(screenshot, option) => {
            void workbench.handleMoveScreenshot(screenshot, option)
          }}
          onDeleteScreenshot={(screenshotId) => {
            void workbench.handleDeleteScreenshot(screenshotId)
          }}
          onDraftAnnotationsChange={workbench.setDraftAnnotations}
          onImportScreenshot={() => {
            void workbench.handleImportScreenshot()
          }}
          onOpenAiComposer={workbench.openAiComposer}
          onMoveAnalysisTrayScreenshot={workbench.moveAnalysisTrayScreenshot}
          onQuickSendToAi={workbench.handleQuickSendToAi}
          onRemoveScreenshotFromAnalysisTray={workbench.removeScreenshotFromAnalysisTray}
          onRunAnalysisForScreenshot={(screenshotId) => workbench.handleRunAnalysisForScreenshot(screenshotId)}
          onRunAnalysisFollowUpForScreenshot={(input) => workbench.handleRunAnalysisFollowUpForScreenshot(input)}
          onSetCompareAnalysisTrayScreenshot={workbench.setCompareAnalysisTrayScreenshot}
          onSetScreenshotStageViewMode={workbench.setScreenshotStageViewMode}
          onSnipScreenshot={() => {
            void workbench.handleOpenSnipCapture()
          }}
          onRestoreAnnotation={(annotationId) => {
            void workbench.handleRestoreAnnotation(annotationId)
          }}
          onRestoreBlock={(block) => {
            void workbench.handleRestoreBlock(block)
          }}
          onRestoreScreenshot={(screenshotId) => {
            void workbench.handleRestoreScreenshot(screenshotId)
          }}
          onSaveAnnotations={() => {
            void workbench.handleSaveAnnotations()
          }}
          onSetPrimaryAnalysisTrayScreenshot={workbench.setPrimaryAnalysisTrayScreenshot}
          onUpdateAnnotation={(input) => {
            void workbench.handleUpdateAnnotation(input)
          }}
          onUpdateNoteBlock={(input) => workbench.handleUpdateNoteBlock(input)}
          moveTargetOptions={workbench.moveTargetOptions}
          onSelectScreenshot={workbench.selectScreenshot}
          payload={workbench.payload}
          screenshotGallery={workbench.screenshotGallery}
          screenshotStageViewMode={workbench.screenshotStageViewMode}
          selectedEvent={workbench.selectedEvent}
          selectedScreenshot={workbench.selectedScreenshot}
        />

        <SessionWorkspaceColumn
          activeAnchors={workbench.activeAnchors}
          analysisCard={workbench.analysisCard}
          anchorReviewSuggestions={workbench.anchorReviewSuggestions}
          anchors={workbench.anchors}
          busy={workbench.busy}
          composerSuggestions={workbench.composerSuggestions}
          currentTrade={workbench.currentTrade}
          deletedAiRecords={workbench.deletedAiRecords}
          groundingHits={workbench.groundingHits}
          latestEvaluation={workbench.latestEvaluation}
          onAddToTrade={(input) => {
            void workbench.handleAddToTrade(input)
          }}
          onCloseTrade={(input) => {
            void workbench.handleCloseTrade(input)
          }}
          onCancelTrade={(input) => {
            void workbench.handleCancelTrade(input)
          }}
          onDeleteAiRecord={(aiRunId) => {
            void workbench.handleDeleteAiRecord(aiRunId)
          }}
          onDeleteBlock={(block) => {
            void workbench.handleDeleteBlock(block)
          }}
          onComposerSuggestionAccept={(suggestion) => {
            void workbench.handleComposerSuggestionAccept(suggestion)
          }}
          onCreateNoteBlock={(input) => workbench.handleCreateNoteBlock(input)}
          onOpenTrade={(input) => {
            void workbench.handleOpenTrade(input)
          }}
          onPasteClipboardImage={() => {
            void workbench.handlePasteClipboardImage()
          }}
          onPasteClipboardImageAndRunAnalysis={() => {
            void workbench.handlePasteClipboardImageAndRunAnalysis()
          }}
          onReorderNoteBlocks={(input) => {
            void workbench.handleReorderNoteBlocks(input)
          }}
          onReduceTrade={(input) => {
            void workbench.handleReduceTrade(input)
          }}
          onRealtimeDraftChange={workbench.setRealtimeDraft}
          onRestoreAiRecord={(aiRunId) => {
            void workbench.handleRestoreAiRecord(aiRunId)
          }}
          onRunAnalysis={() => {
            void workbench.handleRunAnalysis()
          }}
          onRunAnalysisAcrossProviders={() => {
            void workbench.handleRunAnalysisAcrossProviders()
          }}
          onRestoreBlock={(block) => {
            void workbench.handleRestoreBlock(block)
          }}
          onSaveRealtimeView={() => {
            void workbench.handleSaveRealtimeView()
          }}
          onSaveRealtimeViewAndRunAnalysis={() => {
            void workbench.handleSaveRealtimeViewAndRunAnalysis()
          }}
          onSetAnchorStatus={workbench.handleSetAnchorStatus}
          onUpdateNoteBlock={(input) => workbench.handleUpdateNoteBlock(input)}
          payload={workbench.payload}
          realtimeDraft={workbench.realtimeDraft}
          realtimeViewBlock={workbench.realtimeViewBlock}
          selectedScreenshot={workbench.selectedScreenshot}
          similarCases={workbench.similarCases}
        />
      </div>

      <SessionAiDock
        busy={workbench.busy}
        composer={workbench.aiComposer}
        contextChips={workbench.aiDockContextChips}
        dockDraft={workbench.aiDockDraft}
        dockState={workbench.aiDockState}
        dockTab={workbench.aiDockTab}
        lastPacket={workbench.lastAiPacket}
        onOpenComposer={() => workbench.openAiComposer()}
        onSendFollowUp={() => {
          void workbench.handleSendAiDockFollowUp()
        }}
        onSetDockDraft={workbench.setAiDockDraft}
        onSetDockExpanded={workbench.setAiDockExpanded}
        onSetDockSize={workbench.setAiDockSize}
        onSetDockTab={workbench.setAiDockTab}
        payload={workbench.payload}
      />

      <SessionAiComposerDrawer
        busy={workbench.busy}
        composer={workbench.aiComposer}
        onClose={workbench.closeAiComposer}
        onRemoveBackgroundScreenshot={workbench.removeAiComposerBackgroundScreenshot}
        onSend={() => {
          void workbench.handleSendAiComposer()
        }}
        onSetBackgroundDraft={workbench.setAiComposerBackgroundDraft}
        onSetBackgroundToggle={workbench.setAiComposerBackgroundToggle}
        onSetImageRegionMode={workbench.setAiComposerImageRegionMode}
        onSetPrimaryScreenshot={workbench.setAiComposerPrimaryScreenshot}
        screenshots={workbench.payload.screenshots}
      />
    </section>
  ) : (
    <div className="empty-state">{workbench.message ?? '正在加载 Session 工作台...'}</div>
  )
}
