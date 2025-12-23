import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeFirebaseApp } from './core/firebase';

// Design System CSS
import './styles/design-system.css';

// Firebase initialisieren
initializeFirebaseApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
