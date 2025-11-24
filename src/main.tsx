import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ApiProvider } from './lib/ApiContext'
import { NotificationProvider } from './lib/NotificationContext'
import './globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <ApiProvider>
        <App />
      </ApiProvider>
    </NotificationProvider>
  </React.StrictMode>,
)

