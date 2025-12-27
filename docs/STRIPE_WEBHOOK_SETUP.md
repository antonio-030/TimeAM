# Stripe Webhook-Konfiguration

Diese Anleitung erklärt, wie du die Stripe Webhooks für wiederkehrende Abrechnungen konfigurierst.

## Voraussetzungen

1. **Stripe Account**: Du musst einen Stripe Account haben (Test- oder Live-Modus)
2. **API-Keys**: `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` müssen in der `.env` Datei gesetzt sein
3. **Öffentliche URL**: Deine API muss über eine öffentlich erreichbare URL erreichbar sein (z.B. über ngrok für lokale Entwicklung)

## Schritt 1: Webhook-Endpoint in Stripe Dashboard konfigurieren

### Für lokale Entwicklung (mit ngrok):

1. **Starte ngrok** (falls noch nicht gestartet):
   ```bash
   ngrok http 3000
   ```
   > **Hinweis**: Ersetze `3000` mit dem Port, auf dem deine API läuft

2. **Kopiere die HTTPS-URL** von ngrok (z.B. `https://abc123.ngrok.io`)

3. **Gehe zu Stripe Dashboard**:
   - Öffne [Stripe Dashboard](https://dashboard.stripe.com)
   - Wähle **Developers** → **Webhooks** (oder direkt: https://dashboard.stripe.com/webhooks)

4. **Klicke auf "Add endpoint"**

5. **Fülle das Formular aus**:
   - **Endpoint URL**: `https://abc123.ngrok.io/api/stripe/webhooks`
     > **WICHTIG**: 
     > - Die URL muss vollständig sein (mit `https://` und Top-Level-Domain wie `.io`, `.com`, etc.)
     > - Verwende die HTTPS-URL von ngrok + `/api/stripe/webhooks`
     > - Beispiel: `https://abc123.ngrok.io/api/stripe/webhooks` ✅
     > - **NICHT**: `https://timeog/api/stripe/webhooks` ❌ (fehlt TLD)
   - **Description**: `TimeAM Subscription Webhooks`
   - **Version**: `2025-12-15.clover` (oder neueste verfügbare Version)

6. **Klicke auf "Add endpoint"**

### Für Produktion:

1. **Gehe zu Stripe Dashboard** → **Developers** → **Webhooks**

2. **Klicke auf "Add endpoint"**

3. **Fülle das Formular aus**:
   - **Endpoint URL**: `https://timeog.de/api/stripe/webhooks`
     > **WICHTIG**: 
     > - Die URL muss vollständig sein (mit `https://` und Top-Level-Domain)
     > - Für TimeAM Produktion: `https://timeog.de/api/stripe/webhooks` ✅
     > - **NICHT**: `https://timeog/api/stripe/webhooks` ❌ (fehlt `.de`)
   - **Description**: `TimeAM Subscription Webhooks (Production)`
   - **Version**: `2025-12-15.clover`

4. **Klicke auf "Add endpoint"**

## Schritt 2: Webhook-Events abonnieren

Nachdem der Endpoint erstellt wurde, musst du die folgenden Events abonnieren:

### Erforderliche Events:

1. ✅ **`checkout.session.completed`**
   - Wird ausgelöst, wenn ein Kunde den Checkout-Prozess erfolgreich abgeschlossen hat
   - Erstellt die Subscription in Firestore

2. ✅ **`invoice.payment_succeeded`**
   - **WICHTIG**: Wird automatisch jeden Monat/Jahr ausgelöst für wiederkehrende Abrechnungen
   - Aktualisiert die Abrechnungsperioden
   - Erstellt TransactionLog-Einträge

3. ✅ **`invoice.payment_failed`**
   - Wird ausgelöst, wenn eine Zahlung fehlschlägt
   - Setzt Subscription-Status auf `past_due`

4. ✅ **`customer.subscription.updated`**
   - Wird ausgelöst, wenn eine Subscription aktualisiert wird (z.B. Nutzeranzahl geändert)
   - Synchronisiert Änderungen von Stripe zu Firestore

5. ✅ **`customer.subscription.deleted`**
   - Wird ausgelöst, wenn eine Subscription gekündigt wird
   - Deaktiviert Module für den Tenant

### So abonnierst du Events:

1. **Im Stripe Dashboard**: Gehe zu deinem Webhook-Endpoint
2. **Klicke auf "Add events"** oder "Select events"
3. **Wähle die Events aus** (siehe Liste oben)
4. **Klicke auf "Add events"**

**Oder**: Wähle "Select events to listen to" und markiere:
- ✅ `checkout.session.completed`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

## Schritt 3: Webhook Secret kopieren

1. **Im Stripe Dashboard**: Gehe zu deinem Webhook-Endpoint
2. **Klicke auf den Endpoint** (nicht auf "Add events")
3. **Scrolle nach unten** zu "Signing secret"
4. **Klicke auf "Reveal"** oder "Click to reveal"
5. **Kopiere den Secret** (beginnt mit `whsec_...`)

## Schritt 4: Webhook Secret in .env setzen

1. **Öffne die `.env` Datei** in `apps/api/.env`

2. **Füge oder aktualisiere** die Variable:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_dein_webhook_secret_hier
   ```

3. **Speichere die Datei**

4. **Starte den API-Server neu** (falls er läuft)

## Schritt 5: Webhook testen

### Test mit Stripe CLI (empfohlen):

1. **Installiere Stripe CLI** (falls noch nicht installiert):
   ```bash
   # Windows (mit Chocolatey)
   choco install stripe
   
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Linux
   # Siehe: https://stripe.com/docs/stripe-cli
   ```

2. **Logge dich ein**:
   ```bash
   stripe login
   ```

3. **Teste den Webhook-Endpoint**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhooks
   ```

4. **In einem neuen Terminal**: Sende ein Test-Event:
   ```bash
   stripe trigger checkout.session.completed
   ```

5. **Prüfe die Logs** in deinem API-Server - du solltest die Webhook-Logs sehen!

### Test im Stripe Dashboard:

1. **Gehe zu deinem Webhook-Endpoint** im Stripe Dashboard
2. **Klicke auf "Send test webhook"**
3. **Wähle ein Event** (z.B. `checkout.session.completed`)
4. **Klicke auf "Send test webhook"**
5. **Prüfe die Logs** in deinem API-Server

## Schritt 6: Webhook-Logs prüfen

Nachdem ein Webhook ausgelöst wurde, solltest du in den API-Logs sehen:

```
💳 ========== STRIPE WEBHOOK: WIEDERKEHRENDE ABRECHNUNG ==========
💳 Event Type: invoice.payment_succeeded
💳 Event ID: evt_...
💳 Zeitpunkt: 2024-...
...
✅ ========== WIEDERKEHRENDE ABRECHNUNG ERFOLGREICH VERARBEITET ==========
```

## Troubleshooting

### Problem: Webhook wird nicht empfangen

**Lösung**:
1. Prüfe, ob die URL korrekt ist (muss `/api/stripe/webhooks` sein)
2. Prüfe, ob die API öffentlich erreichbar ist (für lokale Entwicklung: ngrok verwenden)
3. Prüfe die Firewall-Einstellungen
4. Prüfe die Stripe Dashboard Logs (unter dem Webhook-Endpoint)

### Problem: "Ungültige Webhook-Signatur"

**Lösung**:
1. Prüfe, ob `STRIPE_WEBHOOK_SECRET` in der `.env` Datei gesetzt ist
2. Prüfe, ob der Secret korrekt kopiert wurde (keine Leerzeichen, vollständig)
3. Stelle sicher, dass du den Secret vom richtigen Webhook-Endpoint kopiert hast
4. Starte den API-Server neu nach Änderung der `.env` Datei

### Problem: Webhook wird empfangen, aber Subscription wird nicht aktualisiert

**Lösung**:
1. Prüfe die API-Logs auf Fehler
2. Prüfe, ob die Subscription in Firestore die `stripeSubscriptionId` hat
3. Prüfe, ob die Events korrekt abonniert sind
4. Prüfe die Firestore-Berechtigungen

### Problem: Wiederkehrende Abrechnungen funktionieren nicht

**WICHTIG**: Stripe führt wiederkehrende Abrechnungen **automatisch** durch!

**Prüfe**:
1. ✅ Ist `invoice.payment_succeeded` Event abonniert?
2. ✅ Wurde die Subscription mit `mode: 'subscription'` erstellt?
3. ✅ Hat die Subscription `recurring: { interval: 'month' }` oder `interval: 'year'`?
4. ✅ Ist die Zahlungsmethode des Kunden gültig?

**Stripe macht die Abrechnungen automatisch** - du musst nichts manuell auslösen!

## Wichtige Hinweise

### Test vs. Live Mode

- **Test Mode**: Verwende Test-Kreditkarten (z.B. `4242 4242 4242 4242`)
- **Live Mode**: Echte Zahlungen - stelle sicher, dass alles korrekt konfiguriert ist!

### Webhook Secret

- **Jeder Webhook-Endpoint hat einen eigenen Secret**
- **Test- und Live-Modus haben unterschiedliche Secrets**
- **Wenn du den Endpoint neu erstellst, musst du den Secret aktualisieren**

### Sicherheit

- ✅ Webhook-Endpoint verwendet Signature-Verifizierung
- ✅ Nur Events mit gültiger Stripe-Signatur werden verarbeitet
- ✅ Webhook-Endpoint benötigt keine Authentifizierung (Stripe signiert die Requests)

## Nächste Schritte

Nach der Konfiguration:

1. ✅ Teste eine Subscription-Erstellung
2. ✅ Prüfe, ob `checkout.session.completed` funktioniert
3. ✅ Warte auf die erste wiederkehrende Abrechnung (oder teste mit Stripe CLI)
4. ✅ Prüfe die TransactionLogs in der Datenbank

## Support

Bei Problemen:
1. Prüfe die API-Logs
2. Prüfe die Stripe Dashboard Webhook-Logs
3. Prüfe die Firestore-Datenbank
4. Teste mit Stripe CLI

---

**Erstellt**: 2024
**Letzte Aktualisierung**: 2024

