/**
 * Legal Pages Component
 * 
 * Datenschutzerklärung und Impressum für DSGVO-Konformität.
 */

import styles from './LegalPage.module.css';

interface LegalPageProps {
  onBack: () => void;
}

/**
 * Datenschutzerklärung
 */
export function PrivacyPage({ onBack }: LegalPageProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button onClick={onBack} className={styles.backButton}>
          ← Zurück
        </button>
        
        <h1 className={styles.title}>Datenschutzerklärung</h1>
        <p className={styles.lastUpdated}>Stand: {new Date().toLocaleDateString('de-DE')}</p>

        <section className={styles.section}>
          <h2>1. Verantwortlicher</h2>
          <p>
            Verantwortlich für die Datenverarbeitung auf dieser Website ist:
          </p>
          <address className={styles.address}>
            <strong>TimeAM</strong><br />
            Jaciel Antonio Acea Ruiz<br />
            Prinzenallee 38<br />
            13359 Berlin<br />
            Deutschland<br /><br />
            E-Mail: datenschutz@timeam.de
          </address>
        </section>

        <section className={styles.section}>
          <h2>2. Erhebung und Speicherung personenbezogener Daten</h2>
          <h3>2.1 Beim Besuch der Website</h3>
          <p>
            Beim Aufrufen unserer Website werden durch den auf Ihrem Endgerät zum Einsatz 
            kommenden Browser automatisch Informationen an den Server unserer Website gesendet. 
            Diese Informationen werden temporär in einem sog. Logfile gespeichert.
          </p>
          <p>Folgende Informationen werden dabei erfasst:</p>
          <ul>
            <li>IP-Adresse des anfragenden Rechners (anonymisiert)</li>
            <li>Datum und Uhrzeit des Zugriffs</li>
            <li>Name und URL der abgerufenen Datei</li>
            <li>Website, von der aus der Zugriff erfolgt (Referrer-URL)</li>
            <li>Verwendeter Browser und ggf. das Betriebssystem Ihres Rechners</li>
          </ul>

          <h3>2.2 Bei Registrierung und Nutzung</h3>
          <p>
            Bei der Registrierung für TimeAM erheben wir folgende Daten:
          </p>
          <ul>
            <li>E-Mail-Adresse</li>
            <li>Passwort (verschlüsselt gespeichert)</li>
            <li>Organisationsname</li>
          </ul>
          <p>
            Bei der Nutzung der Zeiterfassungsfunktionen werden zusätzlich erfasst:
          </p>
          <ul>
            <li>Arbeitszeiteinträge (Clock In/Out Zeiten)</li>
            <li>Schichtinformationen</li>
            <li>Kalenderdaten</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. Zweck der Datenverarbeitung</h2>
          <p>Die Verarbeitung Ihrer personenbezogenen Daten erfolgt zu folgenden Zwecken:</p>
          <ul>
            <li>Bereitstellung der Zeiterfassungs- und Schichtplanungsfunktionen</li>
            <li>Verwaltung Ihres Benutzerkontos</li>
            <li>Kommunikation bezüglich Ihres Kontos</li>
            <li>Verbesserung unserer Dienste (bei Einwilligung zu Analytics)</li>
            <li>Erfüllung rechtlicher Verpflichtungen</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>4. Rechtsgrundlage</h2>
          <p>
            Die Verarbeitung Ihrer Daten erfolgt auf Grundlage folgender Rechtsgrundlagen:
          </p>
          <ul>
            <li>
              <strong>Art. 6 Abs. 1 lit. a DSGVO:</strong> Ihre Einwilligung (z.B. für Analytics-Cookies)
            </li>
            <li>
              <strong>Art. 6 Abs. 1 lit. b DSGVO:</strong> Erfüllung eines Vertrags oder vorvertraglicher Maßnahmen
            </li>
            <li>
              <strong>Art. 6 Abs. 1 lit. f DSGVO:</strong> Berechtigte Interessen (z.B. Sicherheit der Website)
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. Cookies und Tracking</h2>
          <h3>5.1 Notwendige Cookies</h3>
          <p>
            Diese Cookies sind für den Betrieb der Website erforderlich und können nicht deaktiviert werden. 
            Sie werden in der Regel nur als Reaktion auf von Ihnen durchgeführte Aktionen gesetzt, 
            wie z.B. Anmeldung oder Ausfüllen von Formularen.
          </p>
          
          <h3>5.2 Analyse-Cookies</h3>
          <p>
            Mit Ihrer Einwilligung verwenden wir Firebase Analytics, um die Nutzung unserer Website 
            zu analysieren und zu verbessern. Diese Daten werden anonymisiert erfasst. 
            Sie können Ihre Einwilligung jederzeit widerrufen.
          </p>

          <h3>5.3 Marketing-Cookies</h3>
          <p>
            Mit Ihrer Einwilligung können Marketing-Cookies gesetzt werden, um Ihnen relevante 
            Werbung anzuzeigen. Derzeit setzen wir keine Marketing-Cookies ein.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Datenweitergabe</h2>
          <p>
            Eine Übermittlung Ihrer persönlichen Daten an Dritte erfolgt nur:
          </p>
          <ul>
            <li>Wenn Sie Ihre ausdrückliche Einwilligung erteilt haben</li>
            <li>Wenn die Weitergabe zur Erfüllung des Vertrags erforderlich ist</li>
            <li>Wenn wir gesetzlich dazu verpflichtet sind</li>
          </ul>
          <p>
            <strong>Hosting und Cloud-Dienste:</strong> Wir nutzen Firebase (Google) für 
            Authentifizierung, Datenspeicherung und Hosting. Google ist gemäß 
            EU-US Data Privacy Framework zertifiziert.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Ihre Rechte</h2>
          <p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
          <ul>
            <li><strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Sie können Auskunft über Ihre verarbeiteten Daten verlangen.</li>
            <li><strong>Berichtigungsrecht (Art. 16 DSGVO):</strong> Sie können die Berichtigung unrichtiger Daten verlangen.</li>
            <li><strong>Löschungsrecht (Art. 17 DSGVO):</strong> Sie können die Löschung Ihrer Daten verlangen.</li>
            <li><strong>Einschränkung (Art. 18 DSGVO):</strong> Sie können die Einschränkung der Verarbeitung verlangen.</li>
            <li><strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Sie können Ihre Daten in einem gängigen Format erhalten.</li>
            <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie können der Verarbeitung widersprechen.</li>
            <li><strong>Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO):</strong> Sie können Ihre Einwilligung jederzeit widerrufen.</li>
          </ul>
          <p>
            Zur Ausübung Ihrer Rechte wenden Sie sich bitte an: <strong>datenschutz@timeam.de</strong>
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Beschwerderecht</h2>
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung 
            Ihrer personenbezogenen Daten zu beschweren.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Datensicherheit</h2>
          <p>
            Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure Socket Layer) 
            in Verbindung mit der jeweils höchsten Verschlüsselungsstufe. Alle übertragenen Daten sind 
            somit verschlüsselt und können von Dritten nicht eingesehen werden.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Speicherdauer</h2>
          <p>
            Wir speichern Ihre personenbezogenen Daten nur so lange, wie es für die Erfüllung der 
            Verarbeitungszwecke erforderlich ist oder wie es die vom Gesetzgeber vorgesehenen 
            Aufbewahrungsfristen vorsehen.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Änderungen dieser Datenschutzerklärung</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen 
            rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen umzusetzen.
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * Impressum
 */
export function ImprintPage({ onBack }: LegalPageProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button onClick={onBack} className={styles.backButton}>
          ← Zurück
        </button>
        
        <h1 className={styles.title}>Impressum</h1>

        <section className={styles.section}>
          <h2>Angaben gemäß § 5 TMG</h2>
          <address className={styles.address}>
            <strong>TimeAM</strong><br />
            Jaciel Antonio Acea Ruiz<br />
            Prinzenallee 38<br />
            13359 Berlin<br />
            Deutschland
          </address>
        </section>

        <section className={styles.section}>
          <h2>Kontakt</h2>
          <p>
            E-Mail: kontakt@timeam.de
          </p>
        </section>

        <section className={styles.section}>
          <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
          <address className={styles.address}>
            Jaciel Antonio Acea Ruiz<br />
            Prinzenallee 38<br />
            13359 Berlin
          </address>
        </section>

        <section className={styles.section}>
          <h2>Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className={styles.link}>
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten 
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als 
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde 
            Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige 
            Tätigkeit hinweisen.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen 
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Urheberrecht</h2>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen 
            dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art 
            der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen 
            Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </section>
      </div>
    </div>
  );
}
