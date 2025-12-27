# Stripe Webhook Setup Script
# Erstellt automatisch Webhook-Endpoints und abonniert alle benoetigten Events

Write-Host "========== STRIPE WEBHOOK SETUP ==========" -ForegroundColor Cyan
Write-Host ""

# Versuche Stripe CLI zu finden
$stripePath = $null

# Pruefe verschiedene moegliche Pfade
$possiblePaths = @(
    "C:\temp\stripe.exe",
    "stripe",
    "$env:LOCALAPPDATA\Programs\stripe\stripe.exe",
    "$env:ProgramFiles\Stripe\stripe.exe",
    "$env:ProgramFiles(x86)\Stripe\stripe.exe",
    "C:\ProgramData\chocolatey\bin\stripe.exe",
    "$env:USERPROFILE\.local\bin\stripe.exe"
)

foreach ($path in $possiblePaths) {
    try {
        if ($path -eq "stripe") {
            $result = Get-Command stripe -ErrorAction Stop
            $stripePath = $result.Source
        } elseif (Test-Path $path) {
            $stripePath = $path
        }
        if ($stripePath) {
            Write-Host "[OK] Stripe CLI gefunden: $stripePath" -ForegroundColor Green
            break
        }
    } catch {
        continue
    }
}

if (-not $stripePath) {
    Write-Host "[FEHLER] Stripe CLI nicht gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installiere Stripe CLI:" -ForegroundColor Yellow
    Write-Host "   Windows (Chocolatey): choco install stripe" -ForegroundColor White
    Write-Host "   Oder: https://stripe.com/docs/stripe-cli" -ForegroundColor White
    Write-Host ""
    Write-Host "Nach der Installation:" -ForegroundColor Yellow
    Write-Host "   1. stripe login" -ForegroundColor White
    Write-Host "   2. Fuehre dieses Script erneut aus" -ForegroundColor White
    exit 1
}

# Pruefe ob eingeloggt
Write-Host "Pruefe Stripe CLI Login..." -ForegroundColor Yellow
try {
    $config = & $stripePath config --list 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Not logged in"
    }
    Write-Host "[OK] Bereits eingeloggt" -ForegroundColor Green
} catch {
    Write-Host "[WARNUNG] Du bist nicht bei Stripe CLI eingeloggt" -ForegroundColor Yellow
    Write-Host "Logge dich ein..." -ForegroundColor Yellow
    & $stripePath login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FEHLER] Login fehlgeschlagen!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Webhook-Konfiguration:" -ForegroundColor Cyan
Write-Host "   URL: https://timeog.de/api/stripe/webhooks" -ForegroundColor White
Write-Host "   Events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted" -ForegroundColor White
Write-Host ""

# Pruefe ob Webhook bereits existiert
Write-Host "Pruefe ob Webhook bereits existiert..." -ForegroundColor Yellow
try {
    $webhooksJson = & $stripePath webhooks list --limit 100 2>&1
    $existingWebhooks = $webhooksJson | ConvertFrom-Json
    
    $webhookUrl = "https://timeog.de/api/stripe/webhooks"
    $existingWebhook = $existingWebhooks.data | Where-Object { $_.url -eq $webhookUrl } | Select-Object -First 1
    
    if ($existingWebhook) {
        Write-Host "[OK] Webhook-Endpoint existiert bereits: $($existingWebhook.id)" -ForegroundColor Green
        Write-Host "   URL: $($existingWebhook.url)" -ForegroundColor White
        Write-Host ""
        
        # Pruefe Events
        Write-Host "Pruefe abonnierte Events..." -ForegroundColor Yellow
        $webhookDetailsJson = & $stripePath webhooks retrieve $existingWebhook.id 2>&1
        $webhookDetails = $webhookDetailsJson | ConvertFrom-Json
        
        $requiredEvents = @(
            "checkout.session.completed",
            "invoice.payment_succeeded",
            "invoice.payment_failed",
            "customer.subscription.updated",
            "customer.subscription.deleted"
        )
        
        $currentEvents = $webhookDetails.enabled_events
        $missingEvents = $requiredEvents | Where-Object { $_ -notin $currentEvents }
        
        if ($missingEvents.Count -eq 0) {
            Write-Host "[OK] Alle benoetigten Events sind bereits abonniert!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Abonnierte Events:" -ForegroundColor Cyan
            foreach ($event in $currentEvents) {
                Write-Host "   [OK] $event" -ForegroundColor Green
            }
        } else {
            Write-Host "[WARNUNG] Fehlende Events gefunden:" -ForegroundColor Yellow
            foreach ($event in $missingEvents) {
                Write-Host "   [FEHLT] $event" -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "Fuege fehlende Events hinzu..." -ForegroundColor Yellow
            
            # Erstelle Update-Befehl
            $allEvents = $currentEvents + $missingEvents
            $eventsArgs = $allEvents | ForEach-Object { "--enabled-event $_" }
            
            Write-Host ""
            Write-Host "Befehl zum Hinzufuegen der Events:" -ForegroundColor Cyan
            Write-Host "& `"$stripePath`" webhooks update $($existingWebhook.id) $($eventsArgs -join ' ')" -ForegroundColor White
            Write-Host ""
            
            $update = Read-Host "Soll ich die Events jetzt hinzufuegen? (j/n)"
            if ($update -eq "j" -or $update -eq "J" -or $update -eq "y" -or $update -eq "Y") {
                Write-Host "Fuege Events hinzu..." -ForegroundColor Yellow
                $updateResult = & $stripePath webhooks update $existingWebhook.id $eventsArgs 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] Events erfolgreich hinzugefuegt!" -ForegroundColor Green
                } else {
                    Write-Host "[FEHLER] Fehler beim Hinzufuegen der Events:" -ForegroundColor Red
                    Write-Host $updateResult -ForegroundColor Red
                }
            }
        }
        
        Write-Host ""
        Write-Host "Webhook Secret:" -ForegroundColor Cyan
        Write-Host "   $($webhookDetails.secret)" -ForegroundColor White
        Write-Host ""
        Write-Host "Setze in apps/api/.env:" -ForegroundColor Yellow
        Write-Host "   STRIPE_WEBHOOK_SECRET=$($webhookDetails.secret)" -ForegroundColor White
        
    } else {
        Write-Host "Erstelle neuen Webhook-Endpoint..." -ForegroundColor Yellow
        
        $create = Read-Host "Soll ich den Webhook jetzt erstellen? (j/n)"
        if ($create -eq "j" -or $create -eq "J" -or $create -eq "y" -or $create -eq "Y") {
            Write-Host "Erstelle Webhook..." -ForegroundColor Yellow
            $result = & $stripePath webhooks create --url $webhookUrl --enabled-event checkout.session.completed --enabled-event invoice.payment_succeeded --enabled-event invoice.payment_failed --enabled-event customer.subscription.updated --enabled-event customer.subscription.deleted 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $webhook = $result | ConvertFrom-Json
                Write-Host "[OK] Webhook erfolgreich erstellt!" -ForegroundColor Green
                Write-Host "   ID: $($webhook.id)" -ForegroundColor White
                Write-Host "   URL: $($webhook.url)" -ForegroundColor White
                Write-Host ""
                Write-Host "Webhook Secret:" -ForegroundColor Cyan
                Write-Host "   $($webhook.secret)" -ForegroundColor White
                Write-Host ""
                Write-Host "Setze in apps/api/.env:" -ForegroundColor Yellow
                Write-Host "   STRIPE_WEBHOOK_SECRET=$($webhook.secret)" -ForegroundColor White
            } else {
                Write-Host "[FEHLER] Fehler beim Erstellen des Webhooks:" -ForegroundColor Red
                Write-Host $result -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "[FEHLER] Fehler beim Abrufen der Webhooks:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Stelle sicher, dass:" -ForegroundColor Yellow
    Write-Host "   1. Stripe CLI installiert ist" -ForegroundColor White
    Write-Host "   2. Du bei Stripe CLI eingeloggt bist (stripe login)" -ForegroundColor White
    Write-Host "   3. Du die richtigen Berechtigungen hast" -ForegroundColor White
}

Write-Host ""
Write-Host "========== SETUP ABGESCHLOSSEN ==========" -ForegroundColor Green
