#!/bin/bash

# Stripe Webhook Test Script
# Testet die Stripe Webhook-Integration mit Stripe CLI

echo "🔧 ========== STRIPE WEBHOOK TEST =========="
echo ""

# Prüfe ob Stripe CLI installiert ist
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI ist nicht installiert!"
    echo "📦 Installiere mit:"
    echo "   Windows: choco install stripe"
    echo "   macOS: brew install stripe/stripe-cli/stripe"
    echo "   Linux: Siehe https://stripe.com/docs/stripe-cli"
    exit 1
fi

echo "✅ Stripe CLI gefunden"
echo ""

# Prüfe ob API-Server läuft
API_PORT=${API_PORT:-3000}
API_URL="http://localhost:${API_PORT}"

echo "🔍 Prüfe ob API-Server läuft auf ${API_URL}..."
if ! curl -s "${API_URL}/api/health" > /dev/null 2>&1; then
    echo "⚠️  API-Server scheint nicht zu laufen auf ${API_URL}"
    echo "💡 Starte den API-Server in einem anderen Terminal:"
    echo "   npm run dev --workspace=@timeam/api"
    echo ""
    read -p "Trotzdem fortfahren? (j/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[JjYy]$ ]]; then
        exit 1
    fi
else
    echo "✅ API-Server läuft"
fi

echo ""
echo "📋 Webhook-Endpoint: ${API_URL}/api/stripe/webhooks"
echo ""

# Prüfe ob bereits eingeloggt
echo "🔐 Prüfe Stripe CLI Login..."
if ! stripe config --list > /dev/null 2>&1; then
    echo "⚠️  Du bist nicht bei Stripe CLI eingeloggt"
    echo "🔐 Logge dich ein..."
    stripe login
else
    echo "✅ Bereits eingeloggt"
fi

echo ""
echo "🚀 Starte Webhook-Listener..."
echo "📡 Webhooks werden weitergeleitet zu: ${API_URL}/api/stripe/webhooks"
echo ""
echo "⚠️  WICHTIG: Lass dieses Terminal offen!"
echo "📝 In einem NEUEN Terminal kannst du Test-Events senden mit:"
echo "   stripe trigger checkout.session.completed"
echo "   stripe trigger invoice.payment_succeeded"
echo "   stripe trigger invoice.payment_failed"
echo "   stripe trigger customer.subscription.updated"
echo "   stripe trigger customer.subscription.deleted"
echo ""
echo "🛑 Drücke Ctrl+C zum Beenden"
echo ""
echo "=========================================="
echo ""

# Starte Webhook-Listener
stripe listen --forward-to "${API_URL}/api/stripe/webhooks"

