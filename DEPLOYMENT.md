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

### Nginx Reverse Proxy (Optional)

Für Production sollte ein Nginx Reverse Proxy verwendet werden:

```nginx
# /etc/nginx/sites-available/timeam
server {
    listen 80;
    server_name deine-domain.de;

    # Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
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
    }
}
```

Aktiviere die Konfiguration:
```bash
sudo ln -s /etc/nginx/sites-available/timeam /etc/nginx/sites-enabled/
sudo nginx -t
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

### SSL/TLS mit Let's Encrypt (Optional)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de
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

