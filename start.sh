#!/bin/bash

###############################################################################
# TimeAM Production Start Script
# 
# Startet Backend und Frontend auf einem Ubuntu Server
# 
# Verwendung: ./start.sh
###############################################################################

set -e  # Exit on error

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktionen
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    print_error "Bitte führe dieses Script im Hauptverzeichnis des Projekts aus!"
    exit 1
fi

print_info "TimeAM Production Start Script"
echo ""

# Prüfe ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    print_error "Node.js ist nicht installiert. Bitte installiere Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js Version 18+ ist erforderlich. Aktuelle Version: $(node -v)"
    exit 1
fi

print_info "Node.js Version: $(node -v)"

# Prüfe ob PM2 installiert ist
if ! command -v pm2 &> /dev/null; then
    print_warn "PM2 ist nicht installiert. Installiere PM2 global..."
    npm install -g pm2
    print_info "PM2 installiert"
fi

print_info "PM2 Version: $(pm2 -v)"
echo ""

# Prüfe ob Dependencies installiert sind
if [ ! -d "node_modules" ]; then
    print_warn "Dependencies fehlen. Installiere Dependencies..."
    npm install
    print_info "Dependencies installiert"
fi

# Prüfe ob Build existiert
if [ ! -d "apps/api/dist" ]; then
    print_warn "Backend Build fehlt. Baue Backend..."
    npm run build:api
    print_info "Backend Build abgeschlossen"
fi

if [ ! -d "apps/web/dist" ]; then
    print_warn "Frontend Build fehlt. Baue Frontend..."
    npm run build:web
    print_info "Frontend Build abgeschlossen"
fi

# Erstelle Logs-Verzeichnis
mkdir -p logs
print_info "Logs-Verzeichnis erstellt"

# Prüfe ob serve installiert ist (für Frontend)
if ! command -v serve &> /dev/null && ! npm list -g serve &> /dev/null; then
    print_warn "serve ist nicht installiert. Installiere serve global..."
    npm install -g serve
    print_info "serve installiert"
fi

# Prüfe ob .env Datei existiert
if [ ! -f "apps/api/.env" ]; then
    print_warn ".env Datei fehlt in apps/api/"
    print_warn "Bitte erstelle eine .env Datei mit den erforderlichen Umgebungsvariablen"
fi

echo ""
print_info "Starte Anwendung mit PM2..."

# Stoppe alte Instanzen falls vorhanden
pm2 delete timeam-api timeam-web 2>/dev/null || true

# Starte mit PM2
pm2 start ecosystem.config.js

# Speichere PM2 Konfiguration
pm2 save

# Setup PM2 Startup Script (für automatischen Start nach Reboot)
if ! pm2 startup | grep -q "already"; then
    print_info "PM2 Startup Script wird eingerichtet..."
    print_warn "Führe den angezeigten Befehl aus, um PM2 beim Systemstart zu aktivieren"
    pm2 startup
fi

echo ""
print_info "Anwendung gestartet!"
echo ""
print_info "Status anzeigen:    pm2 status"
print_info "Logs anzeigen:      pm2 logs"
print_info "Stoppen:            ./stop.sh"
print_info "Neustarten:         ./restart.sh"
echo ""
print_info "Backend läuft auf:  http://localhost:3000"
print_info "Frontend läuft auf: http://localhost:3001"
echo ""

