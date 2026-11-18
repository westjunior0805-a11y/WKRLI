import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testFirestoreConnection, isFirebaseSyncAllowed } from './firebase.ts';

// Firebase boot connection check runs ONLY on the deployed application
if (isFirebaseSyncAllowed()) {
  testFirestoreConnection().catch((err) => {
    console.warn('Firebase initial connection check warning:', err);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
