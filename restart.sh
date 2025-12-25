#!/bin/bash

###############################################################################
# TimeAM Production Restart Script
# 
# Startet Backend und Frontend neu
# 
# Verwendung: ./restart.sh
###############################################################################

# Farben für Output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_info "Starte TimeAM Anwendung neu..."

# Restart PM2 Prozesse
pm2 restart timeam-api timeam-web 2>/dev/null || {
    echo "Anwendung läuft nicht. Starte mit ./start.sh"
    exit 1
}

print_info "Anwendung neu gestartet!"

