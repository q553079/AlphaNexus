import '@app/styles/app.css'
import { RouterProvider } from 'react-router-dom'
import { appRouter } from '@app/bootstrap/router'
import '@app/styles/tokens.css'
import '@app/styles/global.css'
import '@app/styles/content-targeting.css'
import '@app/styles/event-stream.css'
import '@app/styles/session-event-stream.css'
import '@app/styles/session-workbench.css'
import '@app/styles/capture-overlay.css'
import '@app/styles/capture-overlay-composer.css'
import '@app/styles/trade-detail.css'

export const App = () => <RouterProvider router={appRouter} />
