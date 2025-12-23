# Firestore Datenmodell – TimeAM

## Übersicht

```
/tenants/{tenantId}
    - name: string
    - createdAt: Timestamp
    - createdBy: string (uid)

/tenants/{tenantId}/members/{memberId}
    - uid: string (Firebase Auth UID)
    - email: string
    - role: 'admin' | 'manager' | 'employee'
    - joinedAt: Timestamp
    - invitedBy?: string (uid)

/tenants/{tenantId}/entitlements/{entitlementId}
    - key: string (z.B. 'module.time_tracking')
    - value: boolean | string | number
    - grantedAt: Timestamp

/users/{uid}
    - email: string
    - displayName?: string
    - defaultTenantId?: string
    - createdAt: Timestamp
```

## Collections

### tenants

Haupt-Collection für Mandanten (Firmen/Organisationen).

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| name | string | Name des Tenants |
| createdAt | Timestamp | Erstellungsdatum |
| createdBy | string | UID des Erstellers |

### tenants/{tenantId}/members

Sub-Collection: Mitglieder eines Tenants.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| uid | string | Firebase Auth UID |
| email | string | E-Mail (für Anzeige) |
| role | string | `admin`, `manager`, `employee` |
| joinedAt | Timestamp | Beitrittsdatum |
| invitedBy | string? | UID des Einladenden |

**Hinweis:** `memberId` kann identisch mit `uid` sein für einfaches Lookup.

### tenants/{tenantId}/entitlements

Sub-Collection: Freigeschaltete Features für diesen Tenant.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| key | string | Entitlement-Key (z.B. `module.time_tracking`) |
| value | any | `true`, Limit-Zahl, oder Config-String |
| grantedAt | Timestamp | Freischaltungsdatum |

**Standard-Entitlements bei Tenant-Erstellung:**
- `module.time_tracking: true`
- `module.shift_pool: true`

### users

Globale User-Collection (Mapping Firebase Auth → Tenant).

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| email | string | E-Mail |
| displayName | string? | Anzeigename |
| defaultTenantId | string? | Primärer Tenant |
| createdAt | Timestamp | Erstellungsdatum |

## Abfragen

### User → Tenant Lookup

```typescript
// 1. User-Dokument laden
const userDoc = await getDoc(doc(db, 'users', uid));
const tenantId = userDoc.data()?.defaultTenantId;

// 2. Membership prüfen
const memberDoc = await getDoc(doc(db, `tenants/${tenantId}/members`, uid));
const role = memberDoc.data()?.role;

// 3. Entitlements laden
const entitlementsSnap = await getDocs(collection(db, `tenants/${tenantId}/entitlements`));
```

### Tenant-scoped Queries

Alle Feature-Daten (Shifts, TimeEntries etc.) sind unter `/tenants/{tenantId}/...` gespeichert.
Das garantiert Tenant-Isolation auf Datenbank-Ebene.

## Security Rules Konzept

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: Nur eigenes Dokument
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    
    // Tenants: Nur Mitglieder
    match /tenants/{tenantId} {
      allow read: if isMember(tenantId);
      
      match /members/{memberId} {
        allow read: if isMember(tenantId);
      }
      
      match /entitlements/{entId} {
        allow read: if isMember(tenantId);
      }
    }
    
    function isMember(tenantId) {
      return exists(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
    }
  }
}
```

## Onboarding Flow

1. User registriert sich (Firebase Auth)
2. `GET /api/me` → `needsOnboarding: true` (kein Tenant)
3. User erstellt Tenant via `POST /api/onboarding/create-tenant`
4. Backend erstellt: Tenant + Member (admin) + Default-Entitlements + User-Doc
5. `GET /api/me` → Volle Response mit Tenant-Daten


