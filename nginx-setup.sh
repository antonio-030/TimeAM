#!/bin/bash

###############################################################################
# Nginx Setup Script für TimeAM
# 
# Richtet Nginx Reverse Proxy mit HTTPS ein
# 
# Verwendung: sudo ./nginx-setup.sh
###############################################################################

set -e

# Farben
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

# Prüfe ob root
if [ "$EUID" -ne 0 ]; then 
    print_error "Bitte als root ausführen: sudo ./nginx-setup.sh"
    exit 1
fi

# Domain abfragen
read -p "Gib deine Domain ein (z.B. timeog.de): " DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Domain ist erforderlich!"
    exit 1
fi

print_info "Richte Nginx für $DOMAIN ein..."

# Nginx installieren falls nicht vorhanden
if ! command -v nginx &> /dev/null; then
    print_warn "Nginx ist nicht installiert. Installiere Nginx..."
    apt update
    apt install -y nginx
    print_info "Nginx installiert"
fi

# Nginx Konfiguration erstellen
print_info "Erstelle Nginx Konfiguration..."

cat > /etc/nginx/sites-available/timeam <<EOF
# HTTP → HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Let's Encrypt Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Alle anderen Requests zu HTTPS umleiten
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL Zertifikate (werden von Certbot gesetzt)
    # ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # SSL Konfiguration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (React App)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Konfiguration aktivieren
if [ -L /etc/nginx/sites-enabled/timeam ]; then
    print_warn "Konfiguration bereits aktiviert"
else
    ln -s /etc/nginx/sites-available/timeam /etc/nginx/sites-enabled/
    print_info "Konfiguration aktiviert"
fi

# Default Nginx Site deaktivieren (falls vorhanden)
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    print_info "Default Nginx Site deaktiviert"
fi

# Nginx testen
print_info "Teste Nginx Konfiguration..."
if nginx -t; then
    print_info "Nginx Konfiguration ist gültig"
else
    print_error "Nginx Konfiguration ist ungültig!"
    exit 1
fi

# Certbot installieren
if ! command -v certbot &> /dev/null; then
    print_warn "Certbot ist nicht installiert. Installiere Certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
    print_info "Certbot installiert"
fi

# SSL-Zertifikat erstellen
print_info "Erstelle SSL-Zertifikat mit Let's Encrypt..."
print_warn "Stelle sicher, dass deine Domain auf diese IP zeigt!"
read -p "Weiter mit SSL-Setup? (j/n): " CONTINUE

if [ "$CONTINUE" = "j" ] || [ "$CONTINUE" = "J" ]; then
    certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
        print_error "SSL-Setup fehlgeschlagen. Bitte manuell ausführen:"
        print_info "sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    }
else
    print_warn "SSL-Setup übersprungen. Führe später aus:"
    print_info "sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi

# Nginx starten/neu laden
print_info "Starte Nginx..."
systemctl enable nginx
systemctl restart nginx

print_info "Nginx Setup abgeschlossen!"
echo ""
print_info "Nächste Schritte:"
print_info "1. Stelle sicher, dass VITE_API_BASE_URL in apps/web/.env leer ist"
print_info "2. Baue Frontend neu: npm run build:web"
print_info "3. Starte PM2 neu: pm2 restart timeam-web"
echo ""
print_info "Teste die Anwendung: https://${DOMAIN}"

