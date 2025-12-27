# Stripe Webhook Test Script (PowerShell)
# Testet die Stripe Webhook-Integration mit Stripe CLI

Write-Host "🔧 ========== STRIPE WEBHOOK TEST ==========" -ForegroundColor Cyan
Write-Host ""

# Prüfe ob Stripe CLI installiert ist
try {
    $stripeVersion = stripe --version 2>&1
    Write-Host "✅ Stripe CLI gefunden: $stripeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Stripe CLI ist nicht installiert!" -ForegroundColor Red
    Write-Host "📦 Installiere mit:" -ForegroundColor Yellow
    Write-Host "   Windows: choco install stripe" -ForegroundColor Yellow
    Write-Host "   macOS: brew install stripe/stripe-cli/stripe" -ForegroundColor Yellow
    Write-Host "   Linux: Siehe https://stripe.com/docs/stripe-cli" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Prüfe ob API-Server läuft
$API_PORT = if ($env:API_PORT) { $env:API_PORT } else { "3000" }
$API_URL = "http://localhost:$API_PORT"

Write-Host "🔍 Prüfe ob API-Server läuft auf ${API_URL}..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "${API_URL}/api/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ API-Server läuft" -ForegroundColor Green
} catch {
    Write-Host "⚠️  API-Server scheint nicht zu laufen auf ${API_URL}" -ForegroundColor Yellow
    Write-Host "💡 Starte den API-Server in einem anderen Terminal:" -ForegroundColor Yellow
    Write-Host "   npm run dev --workspace=@timeam/api" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Trotzdem fortfahren? (j/n)"
    if ($continue -ne "j" -and $continue -ne "J" -and $continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host ""
Write-Host "📋 Webhook-Endpoint: ${API_URL}/api/stripe/webhooks" -ForegroundColor Cyan
Write-Host ""

# Prüfe ob bereits eingeloggt
Write-Host "🔐 Prüfe Stripe CLI Login..." -ForegroundColor Yellow
try {
    stripe config --list | Out-Null
    Write-Host "✅ Bereits eingeloggt" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Du bist nicht bei Stripe CLI eingeloggt" -ForegroundColor Yellow
    Write-Host "🔐 Logge dich ein..." -ForegroundColor Yellow
    stripe login
}

Write-Host ""
Write-Host "🚀 Starte Webhook-Listener..." -ForegroundColor Green
Write-Host "📡 Webhooks werden weitergeleitet zu: ${API_URL}/api/stripe/webhooks" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  WICHTIG: Lass dieses Terminal offen!" -ForegroundColor Yellow
Write-Host "📝 In einem NEUEN Terminal kannst du Test-Events senden mit:" -ForegroundColor Yellow
Write-Host "   stripe trigger checkout.session.completed" -ForegroundColor White
Write-Host "   stripe trigger invoice.payment_succeeded" -ForegroundColor White
Write-Host "   stripe trigger invoice.payment_failed" -ForegroundColor White
Write-Host "   stripe trigger customer.subscription.updated" -ForegroundColor White
Write-Host "   stripe trigger customer.subscription.deleted" -ForegroundColor White
Write-Host ""
Write-Host "🛑 Drücke Ctrl+C zum Beenden" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Starte Webhook-Listener
stripe listen --forward-to "${API_URL}/api/stripe/webhooks"

