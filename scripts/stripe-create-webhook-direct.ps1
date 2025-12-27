# Stripe Webhook direkt erstellen
# Verwendet die Stripe API direkt

$stripePath = "C:\temp\stripe.exe"
$webhookUrl = "https://timeog.de/api/stripe/webhooks"

Write-Host "========== STRIPE WEBHOOK ERSTELLEN ==========" -ForegroundColor Cyan
Write-Host ""

# Pruefe ob Stripe CLI existiert
if (-not (Test-Path $stripePath)) {
    Write-Host "[FEHLER] Stripe CLI nicht gefunden: $stripePath" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Stripe CLI gefunden" -ForegroundColor Green
Write-Host ""

# Hole Secret Key (nicht Restricted Key)
Write-Host "Lade Stripe Secret Key..." -ForegroundColor Yellow
Write-Host "HINWEIS: Du musst den Secret Key (sk_live_...) verwenden, nicht den Restricted Key (rk_live_...)" -ForegroundColor Yellow
Write-Host ""

# Versuche Secret Key aus Config zu lesen
$config = & $stripePath config --list 2>&1
$secretKey = ($config | Select-String "test_mode_api_key").ToString() -replace ".*= '", "" -replace "'.*", ""

if (-not $secretKey -or $secretKey -match "^\*+$") {
    Write-Host "[WARNUNG] Secret Key nicht in Config gefunden oder maskiert" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Bitte gib deinen Stripe Secret Key ein (sk_live_... oder sk_test_...):" -ForegroundColor Yellow
    Write-Host "(Der Key wird nicht gespeichert, nur fuer diese Session verwendet)" -ForegroundColor Gray
    $secretKey = Read-Host "Secret Key"
    
    if (-not $secretKey -or $secretKey -notmatch "^sk_(live|test)_") {
        Write-Host "[FEHLER] Ungueltiger Secret Key. Muss mit sk_live_ oder sk_test_ beginnen." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] Secret Key gefunden" -ForegroundColor Green
Write-Host ""

# Erstelle Webhook mit curl (PowerShell hat Invoke-WebRequest)
Write-Host "Erstelle Webhook-Endpoint..." -ForegroundColor Yellow
Write-Host "   URL: $webhookUrl" -ForegroundColor White
Write-Host "   Events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted" -ForegroundColor White
Write-Host ""

$events = @(
    "checkout.session.completed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.updated",
    "customer.subscription.deleted"
)

# Erstelle Body als Form-Data
$bodyParams = @{
    url = $webhookUrl
    description = "TimeAM Subscription Webhooks"
}

# Fuege Events hinzu (jedes Event einzeln)
$eventIndex = 0
foreach ($event in $events) {
    $bodyParams["enabled_events[$eventIndex]"] = $event
    $eventIndex++
}

try {
    $response = Invoke-RestMethod -Uri "https://api.stripe.com/v1/webhook_endpoints" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $secretKey"
        } `
        -Body $bodyParams

    Write-Host "[OK] Webhook erfolgreich erstellt!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Webhook ID: $($response.id)" -ForegroundColor Cyan
    Write-Host "URL: $($response.url)" -ForegroundColor Cyan
    Write-Host "Secret: $($response.secret)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Setze in apps/api/.env:" -ForegroundColor Yellow
    Write-Host "   STRIPE_WEBHOOK_SECRET=$($response.secret)" -ForegroundColor White
    Write-Host ""
    Write-Host "Abonnierte Events:" -ForegroundColor Cyan
    foreach ($event in $response.enabled_events) {
        Write-Host "   [OK] $event" -ForegroundColor Green
    }
    
} catch {
    Write-Host "[FEHLER] Fehler beim Erstellen des Webhooks:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Alternative: Erstelle den Webhook manuell im Stripe Dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Gehe zu: https://dashboard.stripe.com/webhooks" -ForegroundColor White
    Write-Host "   2. Klicke auf 'Add endpoint'" -ForegroundColor White
    Write-Host "   3. URL: $webhookUrl" -ForegroundColor White
    Write-Host "   4. Events: $($events -join ', ')" -ForegroundColor White
}

Write-Host ""
Write-Host "========== FERTIG ==========" -ForegroundColor Green

