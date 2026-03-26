import '@app/styles/app.css'
import { RouterProvider } from 'react-router-dom'
import { appRouter } from '@app/bootstrap/router'
import '@app/styles/tokens.css'
import '@app/styles/global.css'

export const App = () => <RouterProvider router={appRouter} />
