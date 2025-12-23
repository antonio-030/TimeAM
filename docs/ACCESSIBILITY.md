# Accessibility – TimeAM

## Ziel

TimeAM strebt **WCAG 2.2 Level AA** Compliance an.

## Grundprinzipien

### 1. Wahrnehmbar (Perceivable)

- **Textalternativen**: Alle Icon-Buttons haben aria-labels
- **Zeitbasierte Medien**: N/A (keine Videos/Audio)
- **Anpassbar**: Semantische HTML-Struktur (header, nav, main, etc.)
- **Unterscheidbar**: 
  - Farbkontrast ≥ 4.5:1 für normalen Text
  - Farbe nicht einziges Unterscheidungsmerkmal (Badges + Labels)

### 2. Bedienbar (Operable)

- **Tastatur**: Komplette Bedienung ohne Maus möglich
- **Keine Fallen**: Tab führt immer aus Komponenten heraus
- **Zeit**: Keine Zeitlimits für Benutzeraktionen
- **Navigation**: Skip-Links, logische Tab-Reihenfolge

### 3. Verständlich (Understandable)

- **Lesbar**: Deutsche Sprache (de-DE), klare Labels
- **Vorhersehbar**: Konsistente Navigation und Interaktionen
- **Eingabehilfe**: Formular-Labels verknüpft, Fehlermeldungen klar

### 4. Robust

- **Kompatibel**: Valides HTML, ARIA korrekt verwendet
- **Screenreader**: Getestet mit NVDA/VoiceOver

## Komponenten-Checkliste

### Kalender (calendar-core)

| Kriterium | Status | Details |
|-----------|--------|---------|
| Keyboard Navigation | ✅ | Tab, Enter, Space, Escape |
| Fokus-Ring sichtbar | ✅ | outline: 2px solid auf :focus-visible |
| ARIA Labels | ✅ | Alle Buttons beschriftet |
| aria-live für Updates | ✅ | Titel-Region mit polite |
| Dialog Focus Management | ✅ | Focus in Dialog, zurück bei Close |
| Event-Farben + Labels | ✅ | Emoji-Badge + Text-Label |
| Mobile Touch Targets | ✅ | min 44x44px |
| prefers-reduced-motion | ✅ | Animationen deaktiviert |

### Modals/Dialoge

| Kriterium | Status | Details |
|-----------|--------|---------|
| role="dialog" | ✅ | Semantisch korrekt |
| aria-labelledby | ✅ | Verknüpft mit Titel |
| ESC schließt | ✅ | Keyboard-Handler |
| Focus Trap | ⚠️ | Natives `<dialog>` Element |
| Focus Return | ✅ | Zurück zum Auslöser |

### Formulare

| Kriterium | Status | Details |
|-----------|--------|---------|
| Labels verknüpft | ✅ | htmlFor + id |
| Required markiert | ⚠️ | aria-required="true" prüfen |
| Fehler beschrieben | ⚠️ | aria-describedby bei Fehlern |

## Manuelle Test-Checkliste

### Vor jedem Release prüfen:

#### Tastatur-Test
- [ ] Kompletter Flow nur mit Tastatur durchführbar
- [ ] Tab-Reihenfolge logisch
- [ ] Fokus immer sichtbar
- [ ] ESC schließt alle Dialoge
- [ ] Keine Tastatur-Fallen

#### Screenreader-Test (NVDA/VoiceOver)
- [ ] Navigation wird vorgelesen
- [ ] Buttons haben verständliche Beschreibung
- [ ] Kalender-Events werden korrekt angesagt
- [ ] Dialoge werden als solche erkannt
- [ ] Statusänderungen werden mitgeteilt

#### Zoom-Test
- [ ] 200% Browser-Zoom funktioniert
- [ ] Kein horizontales Scrolling bei 320px Breite
- [ ] Text bleibt lesbar

#### Motion-Test
- [ ] prefers-reduced-motion aktivieren
- [ ] Keine ablenkenden Animationen

#### Kontrast-Test
- [ ] Browser High Contrast Mode aktivieren
- [ ] Alle Elemente erkennbar
- [ ] Keine Informationen gehen verloren

## Tools

### Automatisiert
- **eslint-plugin-jsx-a11y**: Lint-Regeln für JSX
- **axe DevTools**: Browser-Extension für Tests
- **Lighthouse**: Performance + Accessibility Audit

### Manuell
- **NVDA** (Windows): Kostenloser Screenreader
- **VoiceOver** (macOS/iOS): Eingebaut
- **Color Contrast Analyzer**: Tool für Kontrast-Prüfung

## Known Issues

1. **Native `<dialog>`**: Focus Trap nicht perfekt in allen Browsern
   - Workaround: Natives Element verwenden, unterstützt von modernen Browsern
   
2. **FullCalendar Drag&Drop**: Nicht implementiert (nicht erforderlich für MVP)

## Ressourcen

- [WCAG 2.2 Richtlinien](https://www.w3.org/WAI/WCAG22/quickref/)
- [FullCalendar Accessibility](https://fullcalendar.io/docs/accessibility)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
