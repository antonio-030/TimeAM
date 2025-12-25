#!/bin/bash

###############################################################################
# Service Check Script
# 
# Prüft ob Backend und Frontend laufen
###############################################################################

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=== TimeAM Service Status ==="
echo ""

# PM2 Status
print_info "PM2 Prozesse:"
pm2 status
echo ""

# Port Checks
print_info "Port-Checks:"
if netstat -tuln | grep -q ":3000"; then
    print_info "✓ Port 3000 (Backend) ist in Benutzung"
    netstat -tuln | grep ":3000"
else
    print_error "✗ Port 3000 (Backend) ist NICHT in Benutzung"
fi
echo ""

if netstat -tuln | grep -q ":3001"; then
    print_info "✓ Port 3001 (Frontend) ist in Benutzung"
    netstat -tuln | grep ":3001"
else
    print_error "✗ Port 3001 (Frontend) ist NICHT in Benutzung"
fi
echo ""

# Test Backend direkt
print_info "Teste Backend direkt (localhost:3000):"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    print_info "✓ Backend antwortet auf localhost:3000"
else
    print_error "✗ Backend antwortet NICHT auf localhost:3000"
    print_warn "Versuche: curl http://localhost:3000/api/health"
fi
echo ""

# Test Frontend direkt
print_info "Teste Frontend direkt (localhost:3001):"
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    print_info "✓ Frontend antwortet auf localhost:3001"
else
    print_error "✗ Frontend antwortet NICHT auf localhost:3001"
fi
echo ""

# Nginx Status
print_info "Nginx Status:"
if systemctl is-active --quiet nginx; then
    print_info "✓ Nginx läuft"
else
    print_error "✗ Nginx läuft NICHT"
fi
echo ""

# Nginx Test
print_info "Nginx Konfiguration testen:"
if nginx -t 2>&1; then
    print_info "✓ Nginx Konfiguration ist gültig"
else
    print_error "✗ Nginx Konfiguration hat Fehler"
fi
echo ""

# PM2 Logs (letzte 10 Zeilen)
print_info "Letzte Backend-Logs:"
pm2 logs timeam-api --lines 10 --nostream 2>/dev/null || print_warn "Keine Backend-Logs verfügbar"
echo ""

print_info "Letzte Frontend-Logs:"
pm2 logs timeam-web --lines 10 --nostream 2>/dev/null || print_warn "Keine Frontend-Logs verfügbar"
echo ""

print_info "=== Ende ==="

