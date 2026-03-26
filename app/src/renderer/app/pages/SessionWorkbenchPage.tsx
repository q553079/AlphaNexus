import { useParams } from 'react-router-dom'
import { SessionCanvasColumn } from '@app/features/session-workbench/SessionCanvasColumn'
import { SessionEventColumn } from '@app/features/session-workbench/SessionEventColumn'
import { SessionWorkbenchHeader } from '@app/features/session-workbench/SessionWorkbenchHeader'
import { SessionWorkspaceColumn } from '@app/features/session-workbench/SessionWorkspaceColumn'
import { useSessionWorkbench } from '@app/features/session-workbench/useSessionWorkbench'

export const SessionWorkbenchPage = () => {
  const { sessionId } = useParams()
  const workbench = useSessionWorkbench(sessionId)

  return workbench.payload ? (
    <section className="session-workbench">
      <SessionWorkbenchHeader
        onExport={() => {
          void workbench.handleExport()
        }}
        onRunAnalysis={() => {
          void workbench.handleRunAnalysis()
        }}
        payload={workbench.payload}
      />

      {workbench.message ? <div className="status-inline session-workbench__status">{workbench.message}</div> : null}

      <div className="session-workbench__layout">
        <SessionEventColumn
          events={workbench.payload.events}
          onSelectEvent={workbench.selectEvent}
          selectedEventId={workbench.selectedEvent?.id ?? null}
        />

        <SessionCanvasColumn
          activeContentBlocks={workbench.activeContentBlocks}
          activeAnnotations={workbench.selectedScreenshotAnnotations}
          adoptedAnnotationKeys={workbench.adoptedAnnotationKeys}
          annotationInspectorItems={workbench.annotationInspectorItems}
          annotationSuggestions={workbench.annotationSuggestions}
          busy={workbench.busy}
          deletedAnnotations={workbench.deletedAnnotations}
          deletedContentBlocks={workbench.deletedContentBlocks}
          deletedScreenshots={workbench.deletedScreenshots}
          draftAnnotations={workbench.draftAnnotations}
          onAdoptAnchor={workbench.handleAdoptAnchorFromAnnotation}
          onAnnotationSuggestionAction={(suggestionId, action) => {
            void workbench.handleAnnotationSuggestionAction(suggestionId, action)
          }}
          onDeleteAnnotation={(annotationId) => {
            void workbench.handleDeleteAnnotation(annotationId)
          }}
          onDeleteBlock={(block) => {
            void workbench.handleDeleteBlock(block)
          }}
          onDeleteScreenshot={(screenshotId) => {
            void workbench.handleDeleteScreenshot(screenshotId)
          }}
          onDraftAnnotationsChange={workbench.setDraftAnnotations}
          onImportScreenshot={() => {
            void workbench.handleImportScreenshot()
          }}
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
          selectedScreenshot={workbench.selectedScreenshot}
        />

        <SessionWorkspaceColumn
          activeTab={workbench.activeTab}
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
          onDeleteAiRecord={(aiRunId) => {
            void workbench.handleDeleteAiRecord(aiRunId)
          }}
          onDeleteBlock={(block) => {
            void workbench.handleDeleteBlock(block)
          }}
          onRealtimeDraftChange={workbench.setRealtimeDraft}
          onRestoreAiRecord={(aiRunId) => {
            void workbench.handleRestoreAiRecord(aiRunId)
          }}
          onRestoreBlock={(block) => {
            void workbench.handleRestoreBlock(block)
          }}
          onSaveRealtimeView={() => {
            void workbench.handleSaveRealtimeView()
          }}
          onSetAnchorStatus={workbench.handleSetAnchorStatus}
          onTabChange={workbench.setActiveTab}
          payload={workbench.payload}
          realtimeDraft={workbench.realtimeDraft}
          realtimeViewBlock={workbench.realtimeViewBlock}
          similarCases={workbench.similarCases}
        />
      </div>
    </section>
  ) : (
    <div className="empty-state">{workbench.message ?? '正在加载 Session 工作台...'}</div>
  )
}
