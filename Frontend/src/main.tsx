import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { SessionProvider } from './auth/SessionProvider';
import { ToastProvider } from './components/ui/Toast';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No existe el elemento #root en index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
