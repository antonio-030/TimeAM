# Aktualisiert die .env Datei mit dem Webhook Secret

$envPath = "apps\api\.env"
$webhookSecret = "whsec_9dmJzkaGmXSbY6Dad6C29dCDQTrkWoxP"

Write-Host "========== AKTUALISIERE .ENV DATEI ==========" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $envPath)) {
    Write-Host "[FEHLER] .env Datei nicht gefunden: $envPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Erstelle neue .env Datei..." -ForegroundColor Yellow
    New-Item -Path $envPath -ItemType File -Force | Out-Null
    Add-Content -Path $envPath -Value "STRIPE_WEBHOOK_SECRET=$webhookSecret"
    Write-Host "[OK] .env Datei erstellt mit Webhook Secret" -ForegroundColor Green
} else {
    Write-Host "[OK] .env Datei gefunden" -ForegroundColor Green
    
    # Lese aktuelle .env
    $envContent = Get-Content $envPath -Raw
    
    # Pruefe ob STRIPE_WEBHOOK_SECRET bereits existiert
    if ($envContent -match "STRIPE_WEBHOOK_SECRET\s*=") {
        Write-Host "Aktualisiere vorhandenes STRIPE_WEBHOOK_SECRET..." -ForegroundColor Yellow
        $envContent = $envContent -replace "STRIPE_WEBHOOK_SECRET\s*=.*", "STRIPE_WEBHOOK_SECRET=$webhookSecret"
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host "[OK] STRIPE_WEBHOOK_SECRET aktualisiert" -ForegroundColor Green
    } else {
        Write-Host "Fuege STRIPE_WEBHOOK_SECRET hinzu..." -ForegroundColor Yellow
        Add-Content -Path $envPath -Value "`nSTRIPE_WEBHOOK_SECRET=$webhookSecret"
        Write-Host "[OK] STRIPE_WEBHOOK_SECRET hinzugefuegt" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Webhook Secret:" -ForegroundColor Cyan
Write-Host "   $webhookSecret" -ForegroundColor White
Write-Host ""
Write-Host "[WICHTIG] Starte den API-Server neu, damit die Aenderungen wirksam werden!" -ForegroundColor Yellow
Write-Host ""
Write-Host "========== FERTIG ==========" -ForegroundColor Green

