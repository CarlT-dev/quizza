import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Confirm this bundle started successfully so Capgo can keep it instead of rolling back to the previous bundle.
CapacitorUpdater.notifyAppReady();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
