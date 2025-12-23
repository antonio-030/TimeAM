# TimeAM

Monorepo: Vite Web + Node API, modularer Monolith.

## Tech Stack

- **Frontend:** Vite + React + TypeScript
- **Backend:** Node.js + TypeScript
- **Auth:** Firebase Authentication
- **Database:** Firestore (via Backend)
- **Storage:** Firebase Storage (via Backend)

## Projektstruktur

```
TimeAM/
├── apps/
│   ├── web/          # Vite Frontend
│   └── api/          # Node Backend
├── packages/
│   └── shared/       # Gemeinsame Types/Schemas
└── docs/             # Dokumentation
```

## Schnellstart

### 1. Firebase Setup

1. Firebase-Projekt erstellen in der [Firebase Console](https://console.firebase.google.com)
2. Web-App registrieren
3. Service Account Key erstellen (Project Settings → Service accounts)

### 2. Environment Variables

```bash
# Frontend
cp apps/web/.env.example apps/web/.env
# → Firebase Client Config eintragen (aus Firebase Console)

# Backend
cp apps/api/.env.example apps/api/.env
# → Service Account Pfad eintragen
```

### 3. Installation & Start

```bash
# Dependencies installieren
npm install

# Frontend starten
cd apps/web && npm run dev

# Backend starten (neues Terminal)
cd apps/api && npm run dev
```

## Dokumentation

- [Architektur](docs/ARCHITECTURE.md) – Core + Module + Entitlements
- [Module](docs/MODULES.md) – Übersicht der Feature-Module
- [Firebase](docs/FIREBASE.md) – Auth-Flow, Tenant-Strategie, Security Rules
- [Environment Variables](docs/ENV.md) – Alle ENV-Variablen erklärt

## Security-Hinweise

### Frontend (VITE_FIREBASE_*)

Die `VITE_`-Variablen sind **öffentlich** und werden ins Frontend-Bundle eingebaut.
Sie sind **keine Secrets** – sie identifizieren nur das Firebase-Projekt.

Sicherheit kommt durch:
- Firebase Authentication (nur authentifizierte User)
- Backend-Validierung (Token + Tenant-Scope)
- Firestore Security Rules

### Backend (Service Account)

Der Service Account ist ein **Secret** mit vollen Admin-Rechten.
**Niemals committen!** Siehe `.gitignore`.
