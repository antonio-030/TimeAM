import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { initializeFirebaseApp } from './core/firebase';

// Design System CSS
import './styles/design-system.css';

// Firebase initialisieren
initializeFirebaseApp();

// WICHTIG: App Check wird NICHT beim App-Start initialisiert, um Konflikte mit Phone Auth zu vermeiden
// App Check wird nur initialisiert, wenn es wirklich benötigt wird (z.B. für API-Requests)
// Der Konflikt zwischen App Check (reCAPTCHA v3) und Phone Auth (reCAPTCHA v2) wird so vermieden
// initializeAppCheck();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
