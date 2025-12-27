# Stripe Webhook Quick Start Checkliste

## ✅ Schnellstart-Checkliste

### 1. Webhook-Endpoint in Stripe Dashboard erstellen

- [ ] Gehe zu [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
- [ ] Klicke auf **"Add endpoint"**
- [ ] Endpoint URL eingeben:
  - **Lokal**: `https://abc123.ngrok.io/api/stripe/webhooks` (ngrok URL + `/api/stripe/webhooks`)
  - **Produktion**: `https://timeog.de/api/stripe/webhooks`
  > ⚠️ **WICHTIG**: Die URL muss vollständig sein mit Top-Level-Domain!
  > - ✅ Richtig: `https://timeog.de/api/stripe/webhooks`
  > - ❌ Falsch: `https://timeog/api/stripe/webhooks` (fehlt `.de`)
- [ ] Klicke auf **"Add endpoint"**

### 2. Webhook-Events abonnieren

Nachdem der Endpoint erstellt wurde, abonniere diese 5 Events:

- [ ] ✅ `checkout.session.completed`
- [ ] ✅ `invoice.payment_succeeded` ⚠️ **WICHTIG für wiederkehrende Abrechnungen**
- [ ] ✅ `invoice.payment_failed`
- [ ] ✅ `customer.subscription.updated`
- [ ] ✅ `customer.subscription.deleted`

**So geht's:**
1. Klicke auf deinen Webhook-Endpoint
2. Klicke auf **"Add events"** oder **"Select events"**
3. Markiere die 5 Events oben
4. Klicke auf **"Add events"**

### 3. Webhook Secret kopieren

- [ ] Gehe zu deinem Webhook-Endpoint
- [ ] Scrolle zu **"Signing secret"**
- [ ] Klicke auf **"Reveal"** oder **"Click to reveal"**
- [ ] Kopiere den Secret (beginnt mit `whsec_...`)

### 4. Webhook Secret in .env setzen

- [ ] Öffne `apps/api/.env`
- [ ] Füge hinzu oder aktualisiere:
  ```env
  STRIPE_WEBHOOK_SECRET=whsec_dein_secret_hier
  ```
- [ ] Speichere die Datei
- [ ] Starte den API-Server neu

### 5. Testen

**Option A: Mit Stripe CLI (empfohlen)**
```bash
# 1. Stripe CLI installieren (falls noch nicht)
# Windows: choco install stripe
# macOS: brew install stripe/stripe-cli/stripe

# 2. Einloggen
stripe login

# 3. Webhooks weiterleiten
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# 4. In neuem Terminal: Test-Event senden
stripe trigger checkout.session.completed
```

**Option B: Im Stripe Dashboard**
- [ ] Gehe zu deinem Webhook-Endpoint
- [ ] Klicke auf **"Send test webhook"**
- [ ] Wähle `checkout.session.completed`
- [ ] Klicke auf **"Send test webhook"**
- [ ] Prüfe die API-Logs

### 6. Logs prüfen

Nach einem Webhook-Event solltest du in den API-Logs sehen:

```
💳 ========== STRIPE WEBHOOK: WIEDERKEHRENDE ABRECHNUNG ==========
💳 Event Type: invoice.payment_succeeded
...
✅ ========== WIEDERKEHRENDE ABRECHNUNG ERFOLGREICH VERARBEITET ==========
```

## 🔍 Troubleshooting

| Problem | Lösung |
|---------|--------|
| Webhook wird nicht empfangen | Prüfe URL, Firewall, ngrok (lokal) |
| "Ungültige Webhook-Signatur" | Prüfe `STRIPE_WEBHOOK_SECRET` in `.env` |
| Subscription wird nicht aktualisiert | Prüfe `stripeSubscriptionId` in Firestore |
| Wiederkehrende Abrechnungen funktionieren nicht | Prüfe ob `invoice.payment_succeeded` abonniert ist |

## 📚 Vollständige Dokumentation

Siehe [STRIPE_WEBHOOK_SETUP.md](./STRIPE_WEBHOOK_SETUP.md) für detaillierte Anleitung.

## ⚠️ Wichtige Hinweise

1. **Stripe führt wiederkehrende Abrechnungen automatisch durch** - du musst nichts manuell machen!
2. **Test- und Live-Modus haben unterschiedliche Secrets** - stelle sicher, dass du den richtigen verwendest
3. **Jeder Webhook-Endpoint hat einen eigenen Secret** - wenn du den Endpoint neu erstellst, aktualisiere den Secret
4. **Für lokale Entwicklung**: Verwende ngrok oder Stripe CLI

---

**Fertig!** 🎉 Nach dieser Checkliste sollten alle Webhooks funktionieren.

