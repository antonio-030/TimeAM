#!/bin/bash

# Sendet Test-Events an den Stripe Webhook-Listener
# WICHTIG: Der Webhook-Listener muss in einem anderen Terminal laufen!

echo "🧪 ========== STRIPE TEST-EVENTS SENDEN =========="
echo ""

# Prüfe ob Stripe CLI installiert ist
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI ist nicht installiert!"
    exit 1
fi

echo "✅ Stripe CLI gefunden"
echo ""
echo "⚠️  WICHTIG: Der Webhook-Listener muss laufen!"
echo "📡 Starte ihn in einem anderen Terminal mit:"
echo "   ./scripts/stripe-webhook-test.sh"
echo ""
read -p "Ist der Listener aktiv? (j/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[JjYy]$ ]]; then
    echo "❌ Bitte starte zuerst den Webhook-Listener!"
    exit 1
fi

echo ""
echo "🧪 Sende Test-Events..."
echo ""

# Liste der Events
EVENTS=(
    "checkout.session.completed"
    "invoice.payment_succeeded"
    "invoice.payment_failed"
    "customer.subscription.updated"
    "customer.subscription.deleted"
)

# Sende jedes Event
for event in "${EVENTS[@]}"; do
    echo "📤 Sende: $event"
    stripe trigger "$event"
    echo ""
    sleep 2
done

echo "✅ Alle Test-Events wurden gesendet!"
echo "📝 Prüfe die API-Logs für die Webhook-Verarbeitung"

