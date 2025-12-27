# Stripe CLI Setup & Testing

Diese Anleitung zeigt, wie du die Stripe CLI verwendest, um Webhooks lokal zu testen.

## Voraussetzungen

1. ✅ **Stripe CLI installiert** (du hast es bereits!)
2. ✅ **API-Server läuft** auf `http://localhost:3000`
3. ✅ **Stripe CLI eingeloggt**: `stripe login`

## Schnellstart

### Option 1: Mit npm-Scripts (empfohlen)

#### 1. Webhook-Listener starten

In einem Terminal:
```bash
npm run stripe:webhook:listen
```

Dies startet den Stripe Webhook-Listener und leitet alle Events an deinen lokalen API-Server weiter.

#### 2. Test-Events senden

In einem **neuen Terminal** (während der Listener läuft):

**Einzelnes Event testen:**
```bash
npm run stripe:webhook:test
```

**Alle wichtigen Events testen:**
```bash
npm run stripe:webhook:test:all
```

### Option 2: Mit Scripts

#### Windows (PowerShell):

**Terminal 1 - Listener starten:**
```powershell
.\scripts\stripe-webhook-test.ps1
```

**Terminal 2 - Test-Events senden:**
```powershell
.\scripts\stripe-send-test-events.ps1
```

#### Linux/macOS (Bash):

**Terminal 1 - Listener starten:**
```bash
chmod +x scripts/stripe-webhook-test.sh
./scripts/stripe-webhook-test.sh
```

**Terminal 2 - Test-Events senden:**
```bash
chmod +x scripts/stripe-send-test-events.sh
./scripts/stripe-send-test-events.sh
```

### Option 3: Manuell mit Stripe CLI

#### 1. Webhook-Listener starten

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhooks
```

#### 2. Test-Events senden

In einem neuen Terminal:

```bash
# Einzelne Events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

## Was passiert?

1. **Stripe CLI** empfängt Events von Stripe (oder sendet Test-Events)
2. **Stripe CLI** leitet sie an deinen lokalen API-Server weiter
3. **Dein API-Server** verarbeitet die Events und loggt alles detailliert

## Webhook Secret für lokale Entwicklung

Wenn du `stripe listen` startest, zeigt die Stripe CLI ein **Webhook Secret** an:

```
> Ready! Your webhook signing secret is whsec_xxxxx
```

**WICHTIG**: Dieses Secret ist **anders** als das Secret aus dem Stripe Dashboard!

### Für lokale Tests:

1. **Kopiere das Secret** aus der Stripe CLI Ausgabe
2. **Setze es in `apps/api/.env`**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```
3. **Starte den API-Server neu**

### Für Produktion:

Verwende das Secret aus dem Stripe Dashboard (wie bereits konfiguriert):
```env
STRIPE_WEBHOOK_SECRET=whsec_c3pQrtvHhzplVf5VWsrGoCyKesewbjKP
```

## Test-Events im Detail

### 1. `checkout.session.completed`

Testet die Subscription-Erstellung:
```bash
stripe trigger checkout.session.completed
```

**Erwartetes Ergebnis:**
- Subscription wird in Firestore erstellt
- TransactionLog wird erstellt
- Module werden aktiviert
- Logs zeigen: `🎉 ========== STRIPE WEBHOOK: CHECKOUT ABGESCHLOSSEN ==========`

### 2. `invoice.payment_succeeded`

Testet wiederkehrende Abrechnungen:
```bash
stripe trigger invoice.payment_succeeded
```

**Erwartetes Ergebnis:**
- Abrechnungsperioden werden aktualisiert
- TransactionLog wird erstellt
- Logs zeigen: `💳 ========== STRIPE WEBHOOK: WIEDERKEHRENDE ABRECHNUNG ==========`

### 3. `invoice.payment_failed`

Testet fehlgeschlagene Zahlungen:
```bash
stripe trigger invoice.payment_failed
```

**Erwartetes Ergebnis:**
- Subscription-Status wird auf `past_due` gesetzt
- TransactionLog mit Fehler wird erstellt
- Logs zeigen: `❌ ========== STRIPE WEBHOOK: ZAHLUNG FEHLGESCHLAGEN ==========`

### 4. `customer.subscription.updated`

Testet Subscription-Updates:
```bash
stripe trigger customer.subscription.updated
```

**Erwartetes Ergebnis:**
- Subscription wird in Firestore aktualisiert
- TransactionLog wird erstellt
- Logs zeigen: `🔄 ========== STRIPE WEBHOOK: SUBSCRIPTION AKTUALISIERT ==========`

### 5. `customer.subscription.deleted`

Testet Subscription-Kündigungen:
```bash
stripe trigger customer.subscription.deleted
```

**Erwartetes Ergebnis:**
- Subscription-Status wird auf `canceled` gesetzt
- Module werden deaktiviert
- TransactionLog wird erstellt
- Logs zeigen: `🗑️ ========== STRIPE WEBHOOK: SUBSCRIPTION GEKÜNDIGT ==========`

## Logs prüfen

Nach jedem Test-Event solltest du in den **API-Logs** sehen:

```
💳 ========== STRIPE WEBHOOK: WIEDERKEHRENDE ABRECHNUNG ==========
💳 Event Type: invoice.payment_succeeded
💳 Event ID: evt_...
...
✅ ========== WIEDERKEHRENDE ABRECHNUNG ERFOLGREICH VERARBEITET ==========
```

## Troubleshooting

### Problem: "Webhook signature verification failed"

**Lösung:**
1. Prüfe, ob `STRIPE_WEBHOOK_SECRET` in `.env` gesetzt ist
2. Verwende das Secret aus der Stripe CLI Ausgabe (nicht aus dem Dashboard!)
3. Starte den API-Server neu

### Problem: "API-Server läuft nicht"

**Lösung:**
1. Starte den API-Server in einem Terminal:
   ```bash
   npm run dev:api
   ```
2. Prüfe, ob er auf Port 3000 läuft: `http://localhost:3000/api/health`

### Problem: "Stripe CLI nicht eingeloggt"

**Lösung:**
```bash
stripe login
```

### Problem: Events werden nicht verarbeitet

**Lösung:**
1. Prüfe, ob der Webhook-Listener läuft
2. Prüfe die API-Logs auf Fehler
3. Prüfe, ob `STRIPE_SECRET_KEY` in `.env` gesetzt ist

## Unterschied: Lokale Tests vs. Produktion

| Aspekt | Lokal (Stripe CLI) | Produktion (Stripe Dashboard) |
|--------|-------------------|-------------------------------|
| **Webhook Secret** | Von `stripe listen` | Aus Stripe Dashboard |
| **URL** | `http://localhost:3000` | `https://timeog.de` |
| **Events** | Test-Events | Echte Events |
| **Verwendung** | Entwicklung & Testing | Live-Betrieb |

## Nächste Schritte

Nach erfolgreichen lokalen Tests:

1. ✅ **Webhook-Endpoint in Stripe Dashboard konfigurieren** (bereits erledigt)
2. ✅ **Fehlende Events hinzufügen** (siehe `STRIPE_WEBHOOK_FIX.md`)
3. ✅ **Webhook Secret für Produktion setzen** (bereits erledigt)
4. ✅ **In Produktion testen** mit echten Subscriptions

---

**Erstellt**: 2024
**Status**: ✅ Bereit für Tests

