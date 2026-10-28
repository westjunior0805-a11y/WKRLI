import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testFirestoreConnection } from './firebase.ts';

// Mandatory Firebase boot connection validation
testFirestoreConnection().catch((err) => {
  console.warn('Firebase initial connection check warning:', err);
});

createRoot(document.getElementById('root')!).render(<App />);
