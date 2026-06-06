import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ccc } from "@ckb-ccc/connector-react"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ccc.Provider>
      <App />
    </ccc.Provider>
  </StrictMode>,
)
