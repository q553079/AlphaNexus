import { createHashRouter } from 'react-router-dom'
import { CaptureOverlayPage } from '@app/routes/capture-overlay'
import { AppFrame } from '@app/ui/AppFrame'
import { ExportsPage } from '@app/routes/exports'
import { HomePage } from '@app/routes/home'
import { KnowledgeReviewPage } from '@app/routes/knowledge-review'
import { PeriodReviewPage } from '@app/routes/period-review'
import { SessionWorkbenchPage } from '@app/routes/session-workbench'
import { SettingsAiPage } from '@app/routes/settings-ai'
import { TradeDetailPage } from '@app/routes/trade-detail'

export const appRouter = createHashRouter([
  {
    path: '/capture-overlay',
    element: <CaptureOverlayPage />,
  },
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sessions/:sessionId', element: <SessionWorkbenchPage /> },
      { path: 'knowledge/review', element: <KnowledgeReviewPage /> },
      { path: 'trades/:tradeId', element: <TradeDetailPage /> },
      { path: 'periods/:periodId', element: <PeriodReviewPage /> },
      { path: 'settings/ai', element: <SettingsAiPage /> },
      { path: 'exports', element: <ExportsPage /> },
    ],
  },
])
