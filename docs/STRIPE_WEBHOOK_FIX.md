# Stripe Webhook-Konfiguration - Fehlende Events hinzufügen

## ⚠️ WICHTIG: Es fehlen wichtige Events!

Du hast aktuell **18 Events** abonniert, aber es fehlen **4 wichtige Events**, die der Code benötigt:

### ❌ Fehlende Events (MÜSSEN hinzugefügt werden):

1. **`checkout.session.completed`** ⚠️ **KRITISCH**
   - Wird benötigt, wenn ein Kunde den Checkout abschließt
   - Erstellt die Subscription in Firestore
   - **Ohne dieses Event funktionieren keine neuen Subscriptions!**

2. **`invoice.payment_succeeded`** ⚠️ **KRITISCH für wiederkehrende Abrechnungen**
   - Wird automatisch jeden Monat/Jahr ausgelöst
   - Aktualisiert Abrechnungsperioden
   - **Du hast `invoice.paid` abonniert, aber der Code benötigt `invoice.payment_succeeded`!**
   - Diese sind **unterschiedliche Events**!

3. **`customer.subscription.updated`** ⚠️ **WICHTIG**
   - Wird benötigt, wenn eine Subscription aktualisiert wird (z.B. Nutzeranzahl geändert)
   - Synchronisiert Änderungen von Stripe zu Firestore

4. **`customer.subscription.deleted`** ⚠️ **WICHTIG**
   - Wird benötigt, wenn eine Subscription gekündigt wird
   - Deaktiviert Module für den Tenant

### ✅ Bereits vorhandene Events (können bleiben):

- `invoice.payment_failed` ✅ (wird verwendet)
- Alle anderen Events können bleiben (werden ignoriert, schaden aber nicht)

## 🔧 So fügst du die fehlenden Events hinzu:

### Schritt 1: Events im Stripe Dashboard hinzufügen

1. **Gehe zu**: https://dashboard.stripe.com/webhooks
2. **Klicke auf deinen Webhook-Endpoint** (`TimeAM`)
3. **Klicke auf "Add events"** oder "Select events"
4. **Suche und markiere diese 4 Events**:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.payment_succeeded` (⚠️ NICHT `invoice.paid`!)
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. **Klicke auf "Add events"**

### Schritt 2: Webhook Secret in .env eintragen

1. **Öffne** `apps/api/.env`
2. **Füge hinzu oder aktualisiere**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_c3pQrtvHhzplVf5VWsrGoCyKesewbjKP
   ```
3. **Speichere die Datei**
4. **Starte den API-Server neu** (falls er läuft)

## 📋 Finale Event-Liste (sollte enthalten):

Nach dem Hinzufügen solltest du **mindestens diese Events** haben:

### Erforderliche Events (MÜSSEN vorhanden sein):
- ✅ `checkout.session.completed`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

### Optionale Events (können bleiben, werden aber ignoriert):
- `invoice.paid` (wird nicht verwendet, kann bleiben)
- `invoice.created`
- `invoice.updated`
- Alle anderen Events, die du bereits abonniert hast

## ⚠️ WICHTIGER HINWEIS zu `invoice.paid` vs `invoice.payment_succeeded`:

- **`invoice.paid`**: Wird ausgelöst, wenn eine Invoice bezahlt wurde (egal wie)
- **`invoice.payment_succeeded`**: Wird ausgelöst, wenn eine Zahlung erfolgreich war (spezifischer)

**Der Code verwendet `invoice.payment_succeeded`** für wiederkehrende Abrechnungen. Du kannst beide abonnieren, aber `invoice.payment_succeeded` ist **erforderlich**!

## ✅ Nach dem Hinzufügen testen:

1. **Prüfe die API-Logs** nach einem Test-Event
2. **Sende ein Test-Event** im Stripe Dashboard:
   - Gehe zu deinem Webhook-Endpoint
   - Klicke auf "Send test webhook"
   - Wähle `checkout.session.completed`
   - Prüfe die Logs

## 🎯 Zusammenfassung:

**Aktuell abonniert**: 18 Events (aber wichtige fehlen)
**Nach dem Fix**: Mindestens 5 Events (die erforderlichen) + optional die anderen

**Nächste Schritte:**
1. ✅ Events hinzufügen (siehe oben)
2. ✅ Webhook Secret in `.env` eintragen
3. ✅ API-Server neu starten
4. ✅ Testen

---

**Erstellt**: 2024
**Status**: ⚠️ Benötigt Aktion vom Benutzer

