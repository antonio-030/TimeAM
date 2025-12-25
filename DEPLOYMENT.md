# TimeAM Deployment Guide

## Ubuntu Server Setup (Hetzner)

### Voraussetzungen

1. **Node.js 18+ installieren:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **PM2 global installieren:**
   ```bash
   sudo npm install -g pm2
   ```

3. **serve global installieren (für Frontend):**
   ```bash
   sudo npm install -g serve
   ```

### Projekt auf Server kopieren

```bash
# Via Git
git clone <repository-url>
cd TimeAM

# Oder via SCP/SFTP
# Kopiere das Projekt-Verzeichnis auf den Server
```

### Umgebungsvariablen einrichten

1. Erstelle `.env` Datei in `apps/api/`:
   ```bash
   cd apps/api
   nano .env
   ```

2. Füge folgende Variablen hinzu:
   ```env
   PORT=3000
   NODE_ENV=production
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY=your-private-key
   FIREBASE_CLIENT_EMAIL=your-client-email
   # ... weitere Umgebungsvariablen
   ```

### Anwendung starten

**Im Hauptverzeichnis ausführen:**

```bash
chmod +x start.sh stop.sh restart.sh
./start.sh
```

### Verfügbare Befehle

- **Start:** `./start.sh`
- **Stop:** `./stop.sh`
- **Restart:** `./restart.sh`
- **Status:** `pm2 status`
- **Logs:** `pm2 logs`
- **Logs (spezifisch):** `pm2 logs timeam-api` oder `pm2 logs timeam-web`

### PM2 Befehle

```bash
# Status anzeigen
pm2 status

# Logs anzeigen
pm2 logs

# Logs für spezifische App
pm2 logs timeam-api
pm2 logs timeam-web

# Prozess neu starten
pm2 restart timeam-api
pm2 restart timeam-web

# Prozess stoppen
pm2 stop timeam-api
pm2 stop timeam-web

# Prozess löschen
pm2 delete timeam-api
pm2 delete timeam-web

# Alle Prozesse löschen
pm2 delete all

# PM2 beim Systemstart aktivieren
pm2 startup
# Führe den angezeigten Befehl aus
```

### Nginx Reverse Proxy (ERFORDERLICH für HTTPS)

Für Production **MUSS** ein Nginx Reverse Proxy mit HTTPS verwendet werden, um gemischte Inhalte zu vermeiden:

```nginx
# /etc/nginx/sites-available/timeam
# HTTP → HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name timeog.de www.timeog.de;

    # Let's Encrypt Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Alle anderen Requests zu HTTPS umleiten
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name timeog.de www.timeog.de;

    # SSL Zertifikate (nach Let's Encrypt Setup)
    ssl_certificate /etc/letsencrypt/live/timeog.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/timeog.de/privkey.pem;
    
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts für lange Requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts für API-Requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS Headers (falls nötig)
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Allow-Credentials true always;
        
        # OPTIONS Preflight
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**WICHTIG:** Ersetze `timeog.de` mit deiner tatsächlichen Domain!

Aktiviere die Konfiguration:
```bash
# Konfiguration erstellen
sudo nano /etc/nginx/sites-available/timeam
# → Inhalt oben einfügen und Domain anpassen

# Konfiguration aktivieren
sudo ln -s /etc/nginx/sites-available/timeam /etc/nginx/sites-enabled/

# Testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

### Firewall konfigurieren

```bash
# UFW Firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSL/TLS mit Let's Encrypt (ERFORDERLICH)

**WICHTIG:** SSL/TLS ist erforderlich, um gemischte Inhalte zu vermeiden!

```bash
# Certbot installieren
sudo apt update
sudo apt install certbot python3-certbot-nginx

# SSL-Zertifikat erstellen (ersetze timeog.de mit deiner Domain)
sudo certbot --nginx -d timeog.de -d www.timeog.de

# Automatische Erneuerung testen
sudo certbot renew --dry-run

# Auto-Renewal ist standardmäßig aktiviert (systemd timer)
```

**Nach SSL-Setup:**

1. **Frontend .env anpassen:**
   ```bash
   # apps/web/.env
   # Leer lassen für gleichen Origin, oder HTTPS-URL setzen
   VITE_API_BASE_URL=
   # ODER (falls andere Domain):
   # VITE_API_BASE_URL=https://api.timeog.de
   ```

2. **Frontend neu bauen:**
   ```bash
   npm run build:web
   pm2 restart timeam-web
   ```

3. **Nginx neu laden:**
   ```bash
   sudo systemctl reload nginx
   ```

### Troubleshooting

**Prozess läuft nicht:**
```bash
pm2 logs timeam-api --lines 50
pm2 logs timeam-web --lines 50
```

**Port bereits belegt:**
```bash
sudo lsof -i :3000
sudo lsof -i :3001
```

**Build-Probleme:**
```bash
npm run build
```

**Dependencies neu installieren:**
```bash
rm -rf node_modules apps/*/node_modules
npm install
```

### Logs

Logs befinden sich im `logs/` Verzeichnis:
- `logs/api-error.log` - Backend Fehler
- `logs/api-out.log` - Backend Output
- `logs/web-error.log` - Frontend Fehler
- `logs/web-out.log` - Frontend Output

### Monitoring

PM2 Monitoring Dashboard:
```bash
pm2 monit
```

