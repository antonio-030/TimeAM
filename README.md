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

## Voraussetzungen

- **Node.js** >= 18.0.0 (empfohlen: LTS-Version)
- **npm** (wird mit Node.js mitgeliefert)
- **Firebase-Projekt** (siehe [Firebase Setup](#1-firebase-setup))

## Installation & Start

### 1. Repository klonen

```bash
git clone <repository-url>
cd TimeAM
```

### 2. Dependencies installieren

```bash
npm install
```

Dies installiert alle Dependencies für Frontend, Backend und das Shared-Paket.

### 3. Firebase Setup

1. Firebase-Projekt erstellen in der [Firebase Console](https://console.firebase.google.com)
2. Web-App registrieren
3. Service Account Key erstellen:
   - Project Settings → Service accounts
   - "Generate new private key" klicken
   - JSON-Datei sicher speichern (z.B. `apps/api/service-account.json`)

### 4. Environment Variables konfigurieren

#### Frontend (apps/web/.env)

```bash
# .env.example kopieren
cp apps/web/.env.example apps/web/.env
```

Dann die Firebase Client Config eintragen (aus Firebase Console → Project Settings → General → Your apps → Web App):

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_BASE_URL=http://localhost:3000
```

#### Backend (apps/api/.env)

```bash
# .env.example kopieren
cp apps/api/.env.example apps/api/.env
```

Dann die Service Account Config eintragen:

```env
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
PORT=3000
NODE_ENV=development
```

**WICHTIG:** Die `service-account.json` Datei **niemals** ins Git committen!

### 5. Anwendung starten

#### Option A: Beide Services gleichzeitig starten (empfohlen)

```bash
npm run dev
```

Dies startet Frontend (Port 5173) und Backend (Port 3000) gleichzeitig.

#### Option B: Services einzeln starten

**Frontend:**
```bash
npm run dev:web
# oder
cd apps/web && npm run dev
```

**Backend (neues Terminal):**
```bash
npm run dev:api
# oder
cd apps/api && npm run dev
```

### 6. Anwendung öffnen

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000

## Build

Für Production-Build:

```bash
# Alle Pakete bauen (Shared → Web → API)
npm run build

# Oder einzeln:
npm run build:web
npm run build:api
```

**WICHTIG:** Das Shared-Paket muss immer zuerst gebaut werden, bevor Web oder API gebaut werden.

## TypeScript-Checks

```bash
# TypeScript-Fehler prüfen (ohne Build)
npm run typecheck
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
