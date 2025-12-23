# Environment Variables – TimeAM

## Überblick

| App | Datei | Präfix | Sichtbarkeit |
|-----|-------|--------|--------------|
| Web (Frontend) | `apps/web/.env` | `VITE_` | **Öffentlich** (im Bundle) |
| API (Backend) | `apps/api/.env` | - | **Privat** (nur Server) |

---

## Frontend (apps/web)

### Datei: `apps/web/.env`

```env
# Firebase Client Configuration
# WICHTIG: Diese Werte sind ÖFFENTLICH und keine Secrets!
# Sie identifizieren nur das Firebase-Projekt.

VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXX

# Optional: API Base URL (falls nicht gleicher Origin)
VITE_API_BASE_URL=http://localhost:3000
```

### Woher kommen die Werte?
1. Firebase Console → Project Settings → General
2. Unter "Your apps" → Web App auswählen
3. Firebase SDK snippet → Config kopieren

### Warum sind diese Werte öffentlich?
- Sie sind nur Identifikatoren, keine Zugriffsschlüssel
- Sicherheit kommt durch Firebase Auth + Backend-Validierung
- Vergleichbar mit einer öffentlichen API-URL

---

## Backend (apps/api)

### Datei: `apps/api/.env`

```env
# Firebase Admin SDK
# Option 1: Pfad zur Service Account JSON
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option 2: Service Account als JSON-String (für Cloud Deployments)
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Firebase Project ID (optional, wird aus Service Account gelesen)
FIREBASE_PROJECT_ID=your-project

# Server
PORT=3000
NODE_ENV=development

# Weitere Backend-spezifische Variablen
# ...
```

### Service Account erstellen
1. Firebase Console → Project Settings → Service accounts
2. "Generate new private key" klicken
3. JSON-Datei sicher speichern (NIEMALS committen!)
4. Pfad in `GOOGLE_APPLICATION_CREDENTIALS` setzen

### Sicherheitshinweise
- Service Account JSON **niemals** ins Git committen
- `.gitignore` enthält bereits `*.json` für Root und `apps/api/`
- Für Deployments: Secret Management des Cloud-Providers nutzen

---

## .gitignore Einträge

Stelle sicher, dass folgende Einträge existieren:

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Firebase Service Account
**/service-account*.json
**/firebase-adminsdk*.json

# Aber .env.example committen!
!.env.example
```

---

## Lokale Entwicklung

### Erstmaliges Setup

```bash
# Frontend
cp apps/web/.env.example apps/web/.env
# → Werte aus Firebase Console eintragen

# Backend
cp apps/api/.env.example apps/api/.env
# → Service Account Pfad eintragen
```

### Typische Probleme

| Problem | Lösung |
|---------|--------|
| `VITE_` Variable undefined | Vite Dev Server neu starten |
| Firebase Admin "no credentials" | `GOOGLE_APPLICATION_CREDENTIALS` Pfad prüfen |
| CORS-Fehler | `VITE_API_BASE_URL` korrekt setzen |

