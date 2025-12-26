# reCAPTCHA Setup – TimeAM

## Übersicht

TimeAM verwendet zwei reCAPTCHA-Versionen:

1. **reCAPTCHA v2** (unsichtbar) – für Firebase Phone Auth (SMS-Verifizierung)
2. **reCAPTCHA v3** – für Firebase App Check (API-Schutz)

## reCAPTCHA Keys erhalten

### Schritt 1: Zugriff auf reCAPTCHA Admin Console

1. Besuchen Sie die [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create)
2. Melden Sie sich mit Ihrem Google-Konto an

### Schritt 2: reCAPTCHA v2 Key erstellen (für Phone Auth)

1. Klicken Sie auf **"Neuen Standort hinzufügen"** oder **"Register a new site"**
2. **Label:** Geben Sie einen Namen ein (z.B. "TimeAM Phone Auth")
3. **reCAPTCHA-Typ:** Wählen Sie **"Challenge (v2)"** → **"Ich bin kein Roboter"-Checkbox**
4. **Domains:** Fügen Sie Ihre Domains hinzu:
   - `localhost` (für Development)
   - `yourdomain.com` (für Production)
   - `*.yourdomain.com` (für alle Subdomains)
5. Akzeptieren Sie die Nutzungsbedingungen
6. Klicken Sie auf **"Senden"** oder **"Submit"**
7. **Kopieren Sie den Site Key** (nicht den Secret Key!)

### Schritt 3: reCAPTCHA v3 Key erstellen (für App Check)

1. Klicken Sie erneut auf **"Neuen Standort hinzufügen"**
2. **Label:** Geben Sie einen Namen ein (z.B. "TimeAM App Check")
3. **reCAPTCHA-Typ:** Wählen Sie **"Score-basiert (v3)"**
4. **Domains:** Fügen Sie Ihre Domains hinzu:
   - `localhost` (für Development)
   - `yourdomain.com` (für Production)
   - `*.yourdomain.com` (für alle Subdomains)
5. Akzeptieren Sie die Nutzungsbedingungen
6. Klicken Sie auf **"Senden"** oder **"Submit"**
7. **Kopieren Sie den Site Key** (nicht den Secret Key!)

## Environment-Variablen setzen

### Frontend (.env Datei in `apps/web/`)

Erstellen Sie eine `.env` Datei in `apps/web/` oder fügen Sie die Keys zu Ihrer bestehenden `.env` Datei hinzu:

```env
# reCAPTCHA v2 (für Phone Auth)
VITE_RECAPTCHA_SITE_KEY_V2=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI

# reCAPTCHA v3 (für App Check)
VITE_RECAPTCHA_SITE_KEY_V3=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

**WICHTIG:**
- Ersetzen Sie die Beispiel-Keys durch Ihre eigenen Keys!
- Die Keys beginnen normalerweise mit `6Le...`
- **Nur die Site Keys** werden im Frontend verwendet
- **Secret Keys** werden nur im Backend verwendet (falls nötig)

### Development vs. Production

Für Development können Sie `localhost` als Domain hinzufügen. Für Production müssen Sie Ihre echte Domain hinzufügen.

## Firebase Console Konfiguration

### Phone Auth aktivieren

1. Öffnen Sie die [Firebase Console](https://console.firebase.google.com/)
2. Wählen Sie Ihr Projekt aus
3. Gehen Sie zu **Authentication** → **Sign-in method**
4. Klicken Sie auf **Phone** und aktivieren Sie es
5. Fügen Sie den **reCAPTCHA v2 Site Key** hinzu (für Phone Auth)
6. Fügen Sie Ihre Domains hinzu

### App Check konfigurieren

1. Gehen Sie zu **App Check** in der Firebase Console
2. Wählen Sie Ihre Web-App aus
3. Wählen Sie **reCAPTCHA v3** als Provider
4. Fügen Sie den **reCAPTCHA v3 Site Key** hinzu
5. Aktivieren Sie App Check

## Testing

### Development

Für lokales Testing können Sie `localhost` als Domain verwenden. Die Keys funktionieren dann auch lokal.

### Production

Stellen Sie sicher, dass:
- Ihre Production-Domain in den reCAPTCHA-Keys registriert ist
- Die Environment-Variablen in Ihrer Production-Umgebung gesetzt sind
- Firebase Phone Auth und App Check korrekt konfiguriert sind

## Troubleshooting

### "reCAPTCHA-Fehler" beim Phone Auth Setup

- Prüfen Sie, ob `VITE_RECAPTCHA_SITE_KEY_V2` gesetzt ist
- Prüfen Sie, ob die Domain in den reCAPTCHA-Keys registriert ist
- Prüfen Sie, ob Phone Auth in Firebase Console aktiviert ist

### "App Check Token nicht verfügbar"

- Prüfen Sie, ob `VITE_RECAPTCHA_SITE_KEY_V3` gesetzt ist
- Prüfen Sie, ob App Check in Firebase Console aktiviert ist
- App Check ist optional – die App funktioniert auch ohne (nur Warnung in Console)

### Keys funktionieren nicht

- Stellen Sie sicher, dass Sie die **Site Keys** (nicht Secret Keys) verwenden
- Prüfen Sie, ob die Domain korrekt in den reCAPTCHA-Keys registriert ist
- Prüfen Sie, ob die Keys in der `.env` Datei korrekt gesetzt sind
- Starten Sie den Dev-Server neu nach Änderungen an der `.env` Datei

## Weitere Informationen

- [reCAPTCHA Dokumentation](https://developers.google.com/recaptcha)
- [Firebase Phone Auth Dokumentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase App Check Dokumentation](https://firebase.google.com/docs/app-check)

