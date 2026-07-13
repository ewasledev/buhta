import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import { initSdk } from './sdk';
import { App } from './App';

initSdk();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
