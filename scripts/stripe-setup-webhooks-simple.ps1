# Stripe Webhook Setup Script - Vereinfachte Version
# Erstellt/aktualisiert Webhook-Endpoints direkt

$stripePath = "C:\temp\stripe.exe"
$webhookUrl = "https://timeog.de/api/stripe/webhooks"

Write-Host "========== STRIPE WEBHOOK SETUP ==========" -ForegroundColor Cyan
Write-Host ""

# Pruefe ob Stripe CLI existiert
if (-not (Test-Path $stripePath)) {
    Write-Host "[FEHLER] Stripe CLI nicht gefunden: $stripePath" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Stripe CLI gefunden: $stripePath" -ForegroundColor Green
Write-Host ""

# Pruefe Login
Write-Host "Pruefe Stripe CLI Login..." -ForegroundColor Yellow
$config = & $stripePath config --list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FEHLER] Nicht eingeloggt. Fuehre aus: & `"$stripePath`" login" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Bereits eingeloggt" -ForegroundColor Green
Write-Host ""

# Liste alle Webhooks
Write-Host "Lade vorhandene Webhooks..." -ForegroundColor Yellow
$webhooksOutput = & $stripePath webhooks list --limit 100 2>&1
$webhooksOutputString = $webhooksOutput -join "`n"

# Pruefe ob unser Webhook bereits existiert
$webhookExists = $webhooksOutputString -match "timeog\.de"

if ($webhookExists) {
    Write-Host "[OK] Webhook-Endpoint existiert bereits" -ForegroundColor Green
    Write-Host ""
    Write-Host "Bitte pruefe im Stripe Dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Gehe zu: https://dashboard.stripe.com/webhooks" -ForegroundColor White
    Write-Host "   2. Klicke auf den Webhook mit URL: $webhookUrl" -ForegroundColor White
    Write-Host "   3. Fuege diese Events hinzu (falls fehlend):" -ForegroundColor White
    Write-Host "      - checkout.session.completed" -ForegroundColor Cyan
    Write-Host "      - invoice.payment_succeeded" -ForegroundColor Cyan
    Write-Host "      - invoice.payment_failed" -ForegroundColor Cyan
    Write-Host "      - customer.subscription.updated" -ForegroundColor Cyan
    Write-Host "      - customer.subscription.deleted" -ForegroundColor Cyan
    Write-Host ""
    
    # Versuche Webhook-ID zu extrahieren
    if ($webhooksOutputString -match '"id":\s*"(we_[^"]+)"') {
        $webhookId = $matches[1]
        Write-Host "Webhook ID gefunden: $webhookId" -ForegroundColor Green
        Write-Host ""
        
        # Lade Webhook-Details
        Write-Host "Lade Webhook-Details..." -ForegroundColor Yellow
        $webhookDetails = & $stripePath webhooks retrieve $webhookId 2>&1
        $webhookDetailsString = $webhookDetails -join "`n"
        
        # Extrahiere Secret
        if ($webhookDetailsString -match '"secret":\s*"(whsec_[^"]+)"') {
            $webhookSecret = $matches[1]
            Write-Host "[OK] Webhook Secret gefunden:" -ForegroundColor Green
            Write-Host "   $webhookSecret" -ForegroundColor White
            Write-Host ""
            Write-Host "Setze in apps/api/.env:" -ForegroundColor Yellow
            Write-Host "   STRIPE_WEBHOOK_SECRET=$webhookSecret" -ForegroundColor White
        }
    }
} else {
    Write-Host "Erstelle neuen Webhook-Endpoint..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Befehl:" -ForegroundColor Cyan
    Write-Host "& `"$stripePath`" webhooks create --url `"$webhookUrl`" --enabled-event checkout.session.completed --enabled-event invoice.payment_succeeded --enabled-event invoice.payment_failed --enabled-event customer.subscription.updated --enabled-event customer.subscription.deleted" -ForegroundColor White
    Write-Host ""
    
    $create = Read-Host "Soll ich den Webhook jetzt erstellen? (j/n)"
    if ($create -eq "j" -or $create -eq "J" -or $create -eq "y" -or $create -eq "Y") {
        Write-Host "Erstelle Webhook..." -ForegroundColor Yellow
        $result = & $stripePath webhooks create --url $webhookUrl --enabled-event checkout.session.completed --enabled-event invoice.payment_succeeded --enabled-event invoice.payment_failed --enabled-event customer.subscription.updated --enabled-event customer.subscription.deleted 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $resultString = $result -join "`n"
            Write-Host "[OK] Webhook erfolgreich erstellt!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Antwort:" -ForegroundColor Cyan
            Write-Host $resultString -ForegroundColor White
            Write-Host ""
            
            # Extrahiere Secret
            if ($resultString -match '"secret":\s*"(whsec_[^"]+)"') {
                $webhookSecret = $matches[1]
                Write-Host "Webhook Secret:" -ForegroundColor Cyan
                Write-Host "   $webhookSecret" -ForegroundColor White
                Write-Host ""
                Write-Host "Setze in apps/api/.env:" -ForegroundColor Yellow
                Write-Host "   STRIPE_WEBHOOK_SECRET=$webhookSecret" -ForegroundColor White
            }
            
            # Extrahiere ID
            if ($resultString -match '"id":\s*"(we_[^"]+)"') {
                $webhookId = $matches[1]
                Write-Host ""
                Write-Host "Webhook ID: $webhookId" -ForegroundColor Green
            }
        } else {
            Write-Host "[FEHLER] Fehler beim Erstellen des Webhooks:" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========== SETUP ABGESCHLOSSEN ==========" -ForegroundColor Green

