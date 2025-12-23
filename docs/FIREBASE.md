# Firebase-Architektur – TimeAM

## Überblick

TimeAM nutzt Firebase für Authentifizierung und Datenhaltung nach folgendem Prinzip:

```
┌─────────────┐      ID Token       ┌─────────────┐      Admin SDK      ┌─────────────┐
│   Frontend  │ ──────────────────► │   Backend   │ ──────────────────► │  Firestore  │
│  (Vite/Web) │  Authorization:     │  (Node API) │   verifyIdToken()   │   Storage   │
│             │  Bearer <token>     │             │                     │             │
└─────────────┘                     └─────────────┘                     └─────────────┘
       │                                   │
       │  Firebase Client SDK              │  Firebase Admin SDK
       │  (nur Auth)                       │  (Firestore, Storage, Auth Admin)
       ▼                                   ▼
┌─────────────┐                     ┌─────────────┐
│  Firebase   │                     │  Service    │
│  Auth       │                     │  Account    │
└─────────────┘                     └─────────────┘
```

## Architektur-Prinzipien

### Frontend (apps/web)
- Nutzt **Firebase Client SDK** ausschließlich für Authentifizierung
- **Keine direkten Firestore/Storage-Zugriffe** vom Frontend
- Alle Datenoperationen laufen über das Backend (API)
- Optional: Firebase App Check für zusätzliche Absicherung

### Backend (apps/api)
- Nutzt **Firebase Admin SDK** für:
  - Token-Verifizierung (`verifyIdToken`)
  - Firestore-Zugriffe (tenant-scoped)
  - Storage-Zugriffe
  - Custom Claims setzen (Tenant, Rolle)
- Erzwingt Tenant-Isolation bei allen Datenzugriffen

## Auth-Flow

### 1. Login im Frontend
```
User → Firebase Auth (signInWithEmailAndPassword / signInWithPopup)
     → Firebase gibt ID Token zurück
     → Frontend speichert Token (automatisch via Firebase SDK)
```

### 2. API-Request mit Token
```typescript
// Frontend: Token bei jedem Request mitsenden
const token = await auth.currentUser?.getIdToken();

fetch('/api/...', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 3. Token-Verifizierung im Backend
```typescript
// Backend: requireAuth Middleware
const token = req.headers.authorization?.replace('Bearer ', '');
const decodedToken = await admin.auth().verifyIdToken(token);

// decodedToken enthält: uid, email, custom claims (tenantId, role)
req.user = {
  uid: decodedToken.uid,
  email: decodedToken.email,
  tenantId: decodedToken.tenantId,  // Custom Claim
  role: decodedToken.role           // Custom Claim
};
```

## Tenant/Role-Strategie

### Option A: Custom Claims (empfohlen)
- Tenant-ID und Rolle werden als Custom Claims im Firebase Token gespeichert
- Serverseitig gesetzt via Admin SDK
- Vorteile: Token enthält alles, kein zusätzlicher DB-Lookup

```typescript
// Einmalig beim User-Setup
await admin.auth().setCustomUserClaims(uid, {
  tenantId: 'tenant_abc',
  role: 'manager'
});
```

### Option B: Firestore User-Dokument
- Mapping in `users/{uid}` mit `tenantId` und `role`
- Backend liest bei jedem Request
- Vorteile: Flexibler, Änderungen sofort wirksam

### Aktuelle Entscheidung
**Option A (Custom Claims)** für Tenant-ID und primäre Rolle.
Bei Bedarf kann zusätzlich ein Firestore-Dokument für erweiterte Berechtigungen genutzt werden.

## Security-Hinweise

### Frontend-Konfiguration (VITE_FIREBASE_*)
- Diese Werte sind **öffentlich** und **keine Secrets**
- Sie identifizieren nur das Firebase-Projekt
- Sicherheit kommt durch:
  - Firebase Auth (nur authentifizierte User)
  - Backend-Validierung (Token + Tenant-Scope)
  - Firestore Security Rules (als Fallback)

### API-Konfiguration (Service Account)
- **NIEMALS** im Frontend oder Git committen
- Via `GOOGLE_APPLICATION_CREDENTIALS` (Pfad) oder Environment Variable
- Volle Admin-Rechte auf Firebase-Projekt

### App Check (optional)
- Schützt API vor Requests von nicht-autorisierten Clients
- Kann später aktiviert werden
- Erfordert zusätzliche Konfiguration im Frontend

## Firestore Security Rules

### Wenn Frontend KEINE direkten Firestore-Zugriffe macht (Standard)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Alles blockieren – nur Admin SDK hat Zugriff
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Wenn Frontend später Firestore lesen soll (z.B. Realtime Updates)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tenant-scoped: User darf nur eigenen Tenant lesen
    match /tenants/{tenantId}/{document=**} {
      allow read: if request.auth != null 
                  && request.auth.token.tenantId == tenantId;
      allow write: if false; // Writes nur über Backend
    }
  }
}
```

## Checkliste für Entwickler

- [ ] Firebase-Projekt erstellen (falls noch nicht vorhanden)
- [ ] Web-App in Firebase Console registrieren
- [ ] Service Account Key erstellen und sicher speichern
- [ ] `.env` Dateien aus `.env.example` erstellen
- [ ] Firestore Security Rules deployen
- [ ] Optional: App Check aktivieren

