import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onRegisterError() {
    // Ignore service worker registration errors inside restricted iframe contexts
  },
});

createRoot(document.getElementById('root')!).render(<App />);
