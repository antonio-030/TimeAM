# Module – TimeAM

## Übersicht

| Modul | Kategorie | Beschreibung |
|-------|-----------|--------------|
| dashboard | Core | Dashboard mit Kennzahlen |
| calendar-core | Core | Kernmodul für Kalenderansicht |
| members | Core | Mitarbeiterverwaltung |
| notifications | Core | Benachrichtigungen |
| time-tracking | Optional | Zeiterfassung |
| shift-pool | Optional | Schichtausschreibung und Bewerbungen |

## Modul-Kategorien

### Core-Module
- **Immer aktiv** – können nicht deaktiviert werden
- Bilden das Fundament der Anwendung
- Dashboard, Kalender, Mitarbeiter, Benachrichtigungen

### Optionale Module
- **Pro Tenant aktivierbar** – können über Admin-Einstellungen gesteuert werden
- Zeiterfassung, Schichtplanung
- Werden über Entitlements gesteuert

## Modul-Verwaltung

### Super-Admin / Developer Dashboard
Nur der **Plattform-Betreiber (CEO/Developer)** kann Module für Organisationen verwalten.

- Zugang über das **🔐 Developer**-Menü (nur sichtbar für Super-Admins)
- Zeigt alle registrierten Organisationen
- Ermöglicht das Aktivieren/Deaktivieren von optionalen Modulen pro Tenant
- Tenant-Admins haben **keinen** Zugriff auf diese Funktionalität

### Super-Admin Konfiguration
Super-Admin UIDs werden in der Backend `.env` Datei konfiguriert:

```env
SUPER_ADMIN_UIDS=uid1,uid2,uid3
```

### API-Endpoints (Super-Admin)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/admin/check` | Prüft Super-Admin-Status |
| GET | `/api/admin/tenants` | Alle Tenants laden |
| GET | `/api/admin/tenants/:tenantId` | Tenant-Details laden |
| PUT | `/api/admin/tenants/:tenantId/modules/:moduleId` | Modul aktivieren/deaktivieren |

### Fehlertoleranz (Error Boundaries)
Jedes optionale Modul ist in eine `ModuleBoundary`-Komponente gewrappt. Falls ein Modul abstürzt:
- Die Core-Anwendung läuft weiter
- Der User sieht eine Fehlermeldung mit "Erneut versuchen"-Button
- Andere Module sind nicht betroffen

---

## calendar-core

Das zentrale Kalendermodul. Zeigt Events aus verschiedenen Quellen an.
Feature-Module liefern Events über den Backend-Aggregation-Endpoint.

### Technologie

- **Library**: FullCalendar (React) v6
- **Views**: Month Grid, Week Grid, Day Grid, List Week/Day
- **Mobile**: Default List-View auf <768px
- **A11y**: WCAG 2.2 AA Ziel (Keyboard, ARIA, Focus Management)

### API Endpoint

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/calendar/events?from=...&to=...` | Kalender-Events laden |

#### Query-Parameter
- `from` (required): Start des Zeitraums (ISO 8601)
- `to` (required): Ende des Zeitraums (ISO 8601)
- `includeModules` (optional): Komma-separierte Liste (shift-pool,time-tracking)

### Event-Quellen

1. **shift-pool**: PUBLISHED Schichten im Zeitraum
2. **time-tracking**: TimeEntries des aktuellen Users

### Entitlement

- **Erforderlich**: `module.calendar_core`
- Events aus anderen Modulen werden nur geladen, wenn das jeweilige Modul-Entitlement aktiv ist

### Barrierefreiheit (A11y)

- Vollständige Tastaturbedienung (Tab, Enter, Space, Escape)
- ARIA-Labels auf allen interaktiven Elementen
- Fokus-Management bei Modal-Dialogen
- Event-Typen nicht nur durch Farbe unterscheidbar (Badges + Labels)
- prefers-reduced-motion respektiert
- Touch Targets >= 44px auf Mobile

---

## time-tracking

Zeiterfassungsmodul für Mitarbeiter.

Funktionen:
- Clock In / Clock Out
- TimeEntries und Timesheets
- Kalender-Events für erfasste Zeiten
- Optional: Approval-Workflow (per Entitlement)

---

## shift-pool

Modul für Schichtausschreibung und Bewerbungsmanagement.

### Funktionen

- Schichten erstellen und veröffentlichen (Admin)
- Pool-Liste mit verfügbaren Schichten (User)
- Bewerbungen von Mitarbeitern (User)
- Annahme/Ablehnung durch Manager (Admin)
- Slot-Management (automatische Reduktion bei Annahme via Firestore-Transaktion)
- Audit-Logging für alle wichtigen Aktionen

### Kernzustände

- **Shift:** `DRAFT` → `PUBLISHED` → `CLOSED` / `CANCELLED`
- **Application:** `PENDING` → `ACCEPTED` / `REJECTED` / `WITHDRAWN`
- **Assignment:** `CONFIRMED` / `CANCELLED`

### API Endpoints

#### Admin Endpoints
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/api/shift-pool/shifts` | Schicht erstellen (DRAFT) |
| GET | `/api/shift-pool/admin/shifts` | Alle Schichten (Admin-Sicht) |
| POST | `/api/shift-pool/shifts/:shiftId/publish` | Schicht veröffentlichen |
| GET | `/api/shift-pool/shifts/:shiftId/applications` | Bewerbungen einer Schicht |
| POST | `/api/shift-pool/applications/:appId/accept` | Bewerbung annehmen |
| POST | `/api/shift-pool/applications/:appId/reject` | Bewerbung ablehnen |

#### User Endpoints
| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/shift-pool/pool` | Pool-Liste (PUBLISHED) |
| GET | `/api/shift-pool/shifts/:shiftId` | Schicht-Details |
| POST | `/api/shift-pool/shifts/:shiftId/apply` | Auf Schicht bewerben |
| POST | `/api/shift-pool/applications/:appId/withdraw` | Bewerbung zurückziehen |

### Firestore Collections

```
/tenants/{tenantId}/shifts/{shiftId}
/tenants/{tenantId}/applications/{applicationId}
/tenants/{tenants}/assignments/{assignmentId}
/tenants/{tenantId}/auditLogs/{auditId}
```

### Sicherheit

- **Entitlement:** `module.shift_pool` erforderlich
- **Tenant-Scope:** Alle Daten sind tenant-scoped
- **Transaktionen:** Accept-Operation nutzt Firestore-Transaktion für Konsistenz
- **Audit-Logging:** Alle wichtigen Aktionen werden protokolliert

### Design-Entscheidungen (MVP)

1. **Rollen:** Für MVP werden keine separaten Admin-Rollen geprüft. Alle authentifizierten User mit dem shift_pool-Entitlement können Admin-Aktionen ausführen. In Production sollte eine Rollenprüfung implementiert werden.

2. **Realtime:** Für MVP werden keine Firestore-Realtime-Listener verwendet. Alle Daten werden über die API geladen.

3. **Composite Indexes:** Die Queries sind so gestaltet, dass sie ohne Composite Indexes funktionieren (Client-seitige Filterung). Für bessere Performance sollten Indexes erstellt werden.

4. **Deadline-Prüfung:** Die Bewerbungsfrist wird nur bei der Apply-Action geprüft, nicht beim Laden der Pool-Liste.

