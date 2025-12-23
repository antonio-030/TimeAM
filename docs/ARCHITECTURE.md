# Architektur – TimeAM

## Überblick

TimeAM ist ein modularer Monolith bestehend aus:
- **Web App** (Vite/React) – Frontend für Benutzer
- **API** (Node/TypeScript) – Backend mit Business-Logik

## Core

Der Core stellt zentrale Funktionen bereit:
- **Auth** – Authentifizierung und Session-Management
- **Tenancy** – Multi-Tenant-Isolation (alle Daten sind tenant-scoped)
- **Entitlements** – Feature-Freischaltung pro Tenant
- **Module Registry** – Dynamische Registrierung von Feature-Modulen

## Module

Module sind eigenständige Feature-Pakete. Jedes Modul definiert:
- Eigene Routes (Frontend + Backend)
- Benötigte Entitlements
- Optional: Kalender-Event-Provider

## Kalender-Core

Das calendar-core Modul ist das zentrale Kalendermodul und nutzt **FullCalendar (React)** als Basis-Library.

### Warum FullCalendar?

1. **Accessibility**: Built-in WAI-ARIA-Support und Keyboard-Navigation
2. **Mobile**: List View (listDay/listWeek) als native Mobile-Ansicht
3. **Flexibilität**: Pluggable Architecture mit Grid/Time/List Views
4. **Lokalisierung**: Umfangreiche i18n-Unterstützung (de-DE)
5. **Community**: Aktive Wartung, gute Dokumentation

### Event-Provider-Pattern

Feature-Module (time-tracking, shift-pool) liefern Events über den Backend-Aggregation-Endpoint.
Das Frontend fragt nur `/api/calendar/events` ab und erhält alle Events konsolidiert.

```
┌─────────────────┐     ┌─────────────────┐
│  time-tracking  │     │   shift-pool    │
│  (TimeEntries)  │     │    (Shifts)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │ calendar-core│
              │ (Aggregation)│
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Frontend   │
              │ (FullCal.)  │
              └─────────────┘
```

## Entitlements

Entitlements steuern, welche Features ein Tenant nutzen darf:
- Backend erzwingt Entitlements bei allen Modul-Endpunkten
- Frontend nutzt Entitlements für Navigation und Route-Guards
- Keine Security-Entscheidungen nur im Frontend

### Default-Entitlements (bei Tenant-Erstellung)
- `module.calendar_core: true` – Kalender (immer aktiv)
- `module.time_tracking: true` – Zeiterfassung
- `module.shift_pool: true` – Schichtplanung

## Security-Kette

Jeder Backend-Request durchläuft:
1. Auth (Benutzer authentifiziert?)
2. Tenant-Scope (Zugriff nur auf eigene Tenant-Daten)
3. Entitlement (Feature freigeschaltet?)
4. Permission (Berechtigung für Aktion?)

