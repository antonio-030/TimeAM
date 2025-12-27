# Sendet Test-Events an den Stripe Webhook-Listener (PowerShell)
# WICHTIG: Der Webhook-Listener muss in einem anderen Terminal laufen!

Write-Host "🧪 ========== STRIPE TEST-EVENTS SENDEN ==========" -ForegroundColor Cyan
Write-Host ""

# Prüfe ob Stripe CLI installiert ist
try {
    stripe --version | Out-Null
    Write-Host "✅ Stripe CLI gefunden" -ForegroundColor Green
} catch {
    Write-Host "❌ Stripe CLI ist nicht installiert!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⚠️  WICHTIG: Der Webhook-Listener muss laufen!" -ForegroundColor Yellow
Write-Host "📡 Starte ihn in einem anderen Terminal mit:" -ForegroundColor Yellow
Write-Host "   .\scripts\stripe-webhook-test.ps1" -ForegroundColor White
Write-Host ""
$continue = Read-Host "Ist der Listener aktiv? (j/n)"
if ($continue -ne "j" -and $continue -ne "J" -and $continue -ne "y" -and $continue -ne "Y") {
    Write-Host "❌ Bitte starte zuerst den Webhook-Listener!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🧪 Sende Test-Events..." -ForegroundColor Green
Write-Host ""

# Liste der Events
$events = @(
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.updated",
    "customer.subscription.deleted"
)

# Sende jedes Event
foreach ($event in $events) {
    Write-Host "📤 Sende: $event" -ForegroundColor Cyan
    stripe trigger $event
    Write-Host ""
    Start-Sleep -Seconds 2
}

Write-Host "✅ Alle Test-Events wurden gesendet!" -ForegroundColor Green
Write-Host "📝 Prüfe die API-Logs für die Webhook-Verarbeitung" -ForegroundColor Yellow

