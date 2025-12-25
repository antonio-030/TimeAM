#!/bin/bash

###############################################################################
# TimeAM Production Stop Script
# 
# Stoppt Backend und Frontend
# 
# Verwendung: ./stop.sh
###############################################################################

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_info "Stoppe TimeAM Anwendung..."

# Stoppe PM2 Prozesse
pm2 stop timeam-api timeam-web 2>/dev/null || print_warn "Keine laufenden Prozesse gefunden"

print_info "Anwendung gestoppt!"

