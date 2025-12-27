/**
 * reCAPTCHA v2 für Telefonnummer-Authentifizierung
 *
 * Erstellt und verwaltet reCAPTCHA v2 Verifier für Firebase Phone Auth.
 * Verwendet unsichtbares reCAPTCHA (invisible).
 * 
 * WICHTIG: Es gibt einen bekannten Konflikt zwischen App Check (reCAPTCHA v3)
 * und RecaptchaVerifier (reCAPTCHA v2). Dieser Workaround umgeht den Konflikt.
 */

import { RecaptchaVerifier, type RecaptchaVerifier as RecaptchaVerifierType } from 'firebase/auth';
import { getFirebaseAuth } from './auth';

let recaptchaVerifier: RecaptchaVerifierType | null = null;
let recaptchaV2ScriptLoaded = false;

/**
 * Lädt die reCAPTCHA v2 Bibliothek separat, um Konflikte mit App Check zu vermeiden.
 * WICHTIG: App Check lädt reCAPTCHA v3, was zu Konflikten mit reCAPTCHA v2 führt.
 * Diese Funktion stellt sicher, dass reCAPTCHA v2 korrekt geladen ist.
 */
async function loadRecaptchaV2Script(siteKey: string): Promise<void> {
  if (recaptchaV2ScriptLoaded) {
    console.log('🔵 [reCAPTCHA] reCAPTCHA v2 Script bereits geladen');
    // Prüfe, ob grecaptcha.render verfügbar ist
    if ((window as any).grecaptcha && typeof (window as any).grecaptcha.render === 'function') {
      console.log('✅ [reCAPTCHA] grecaptcha.render verfügbar');
      return;
    } else {
      console.warn('⚠️  [reCAPTCHA] grecaptcha.render nicht verfügbar, lade neu...');
      recaptchaV2ScriptLoaded = false;
    }
  }

  return new Promise((resolve, reject) => {
    // WICHTIG: Entferne alle vorhandenen reCAPTCHA Scripts, um Konflikte zu vermeiden
    // App Check könnte bereits ein Script geladen haben
    const existingScripts = document.querySelectorAll(`script[src*="recaptcha"]`);
    existingScripts.forEach(script => {
      console.log('🔵 [reCAPTCHA] Entferne vorhandenes reCAPTCHA Script:', (script as HTMLScriptElement).src);
      script.remove();
    });
    
    // WICHTIG: Setze grecaptcha zurück, falls es bereits existiert
    // App Check könnte es initialisiert haben, aber ohne render()
    if ((window as any).grecaptcha) {
      console.log('🔵 [reCAPTCHA] Setze grecaptcha zurück');
      delete (window as any).grecaptcha;
    }

    // Lade reCAPTCHA v2 Script mit explicit render
    // WICHTIG: render=explicit ist notwendig, damit grecaptcha.render() verfügbar ist
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('✅ [reCAPTCHA] reCAPTCHA v2 Script geladen');
      // Warte, bis grecaptcha verfügbar ist und render() hat
      const checkInterval = setInterval(() => {
        const grecaptcha = (window as any).grecaptcha;
        if (grecaptcha && typeof grecaptcha.render === 'function') {
          console.log('✅ [reCAPTCHA] grecaptcha.render verfügbar');
          clearInterval(checkInterval);
          recaptchaV2ScriptLoaded = true;
          resolve();
        } else {
          console.log('🔵 [reCAPTCHA] Warte auf grecaptcha.render...', {
            grecaptcha: !!grecaptcha,
            hasRender: grecaptcha && typeof grecaptcha.render === 'function',
          });
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        const grecaptcha = (window as any).grecaptcha;
        if (grecaptcha && typeof grecaptcha.render === 'function') {
          console.log('✅ [reCAPTCHA] grecaptcha.render verfügbar (nach Timeout)');
          recaptchaV2ScriptLoaded = true;
          resolve();
        } else {
          console.warn('⚠️  [reCAPTCHA] grecaptcha.render nicht verfügbar nach 5 Sekunden');
          console.warn('⚠️  [reCAPTCHA] Versuche trotzdem weiter...');
          recaptchaV2ScriptLoaded = true;
          resolve();
        }
      }, 5000);
    };
    
    script.onerror = () => {
      console.error('❌ [reCAPTCHA] Fehler beim Laden des reCAPTCHA v2 Scripts');
      reject(new Error('Fehler beim Laden des reCAPTCHA v2 Scripts'));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Erstellt einen neuen reCAPTCHA v2 Verifier (unsichtbar).
 * 
 * @param containerId - ID des HTML-Elements, in dem reCAPTCHA gerendert wird (optional für invisible)
 * @returns RecaptchaVerifier Instanz
 */
export async function createRecaptchaVerifier(containerId?: string): Promise<RecaptchaVerifierType> {
  // Alten Verifier aufräumen, falls vorhanden
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (error) {
      // Ignoriere Fehler beim Aufräumen
      console.warn('Fehler beim Aufräumen des alten reCAPTCHA Verifiers:', error);
    }
    recaptchaVerifier = null;
  }

  // Prüfe, ob reCAPTCHA v2 Site Key vorhanden ist
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY_V2;
  
  if (!recaptchaSiteKey) {
    throw new Error('VITE_RECAPTCHA_SITE_KEY_V2 nicht gesetzt. Bitte konfigurieren Sie reCAPTCHA v2 in der .env Datei.');
  }

  try {
    console.log('🔵 [reCAPTCHA] Starte Verifier-Erstellung...');
    
    // WICHTIG: Deaktiviere App Check temporär, um Konflikt mit Phone Auth zu vermeiden
    const { disableAppCheck, getFirebaseAppCheck } = await import('./app-check.js');
    const appCheck = getFirebaseAppCheck();
    if (appCheck) {
      console.warn('⚠️  [reCAPTCHA] App Check ist aktiviert - deaktiviere temporär für Phone Auth');
      disableAppCheck();
    }
    
    // WICHTIG: Lade reCAPTCHA v2 Bibliothek IMMER separat, um Konflikt mit App Check zu vermeiden
    // App Check verwendet reCAPTCHA v3, das window.grecaptcha ohne render() initialisiert
    // Wir müssen sicherstellen, dass reCAPTCHA v2 korrekt geladen ist
    await loadRecaptchaV2Script(recaptchaSiteKey);
    
    const auth = getFirebaseAuth();
    console.log('🔵 [reCAPTCHA] Auth-Instanz erhalten');
    
    // ReCAPTCHA v2 Verifier-Konfiguration (unsichtbar)
    // WICHTIG: Keine Callbacks in der Konfiguration, da diese den Konflikt verschlimmern können
    const recaptchaConfig = {
      size: 'invisible' as const, // Unsichtbares reCAPTCHA
    };
    console.log('🔵 [reCAPTCHA] Konfiguration erstellt:', recaptchaConfig);
    
    // WICHTIG: Für invisible reCAPTCHA benötigt Firebase v10 einen Container
    // Erstelle ein unsichtbares div-Element als Container
    const containerIdToUse = containerId || 'recaptcha-invisible-container';
    console.log('🔵 [reCAPTCHA] Container-ID:', containerIdToUse);
    
    // Entferne vorhandenes Element, falls vorhanden (um Konflikte zu vermeiden)
    const existingElement = document.getElementById(containerIdToUse);
    if (existingElement) {
      console.log('🔵 [reCAPTCHA] Entferne vorhandenes Element');
      existingElement.remove();
      // Warte kurz, damit das Element vollständig entfernt ist
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // WICHTIG: Container-Element sollte bereits im HTML existieren (index.html)
    // Falls nicht, erstelle es dynamisch
    let container = document.getElementById(containerIdToUse);
    
    if (!container) {
      console.warn('⚠️  [reCAPTCHA] Container-Element nicht im HTML gefunden, erstelle es dynamisch...');
      // Erstelle neues Container-Element
      container = document.createElement('div');
      container.id = containerIdToUse;
      container.style.visibility = 'hidden';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.overflow = 'hidden';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-1';
      
      // Stelle sicher, dass das Element im DOM ist
      document.body.appendChild(container);
      console.log('🔵 [reCAPTCHA] Container ins DOM eingefügt');
    } else {
      console.log('🔵 [reCAPTCHA] Container-Element bereits im HTML vorhanden');
    }
    
    console.log('🔵 [reCAPTCHA] Container-Element:', {
      id: container.id,
      tagName: container.tagName,
      nodeType: container.nodeType,
      hasChildNodes: typeof container.hasChildNodes,
      isConnected: container.isConnected,
    });
    
    // WICHTIG: Warte, bis das Element wirklich im DOM ist
    // Verwende mehrere requestAnimationFrame für zuverlässigere DOM-Erkennung
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const elementInDom = document.getElementById(containerIdToUse);
          console.log('🔵 [reCAPTCHA] Nach requestAnimationFrame:', {
            elementInDom: !!elementInDom,
            parentNode: elementInDom?.parentNode?.nodeName,
            isConnected: elementInDom?.isConnected,
            hasChildNodes: typeof elementInDom?.hasChildNodes,
          });
          
          if (elementInDom && elementInDom.isConnected && typeof elementInDom.hasChildNodes === 'function') {
            console.log('🔵 [reCAPTCHA] Element ist im DOM und gültig');
            resolve();
          } else {
            // Fallback: Nochmal warten
            console.log('🔵 [reCAPTCHA] Warte noch 50ms...');
            setTimeout(resolve, 50);
          }
        });
      });
    });
    
    // Hole das Element erneut aus dem DOM (um sicherzustellen, dass es wirklich im DOM ist)
    const finalContainer = document.getElementById(containerIdToUse);
    console.log('🔵 [reCAPTCHA] Finales Container-Element:', {
      exists: !!finalContainer,
      type: finalContainer?.constructor.name,
      nodeType: finalContainer?.nodeType,
      hasChildNodes: typeof finalContainer?.hasChildNodes,
      isHTMLElement: finalContainer instanceof HTMLElement,
      isElement: finalContainer instanceof Element,
      isNode: finalContainer instanceof Node,
      isConnected: finalContainer?.isConnected,
      parentNode: finalContainer?.parentNode?.nodeName,
    });
    
    if (!finalContainer) {
      console.error('❌ [reCAPTCHA] Container-Element konnte nicht erstellt werden');
      throw new Error('Container-Element konnte nicht erstellt werden');
    }
    
    // Prüfe, ob hasChildNodes verfügbar ist
    if (typeof finalContainer.hasChildNodes !== 'function') {
      console.error('❌ [reCAPTCHA] hasChildNodes ist keine Funktion:', {
        hasChildNodes: finalContainer.hasChildNodes,
        type: typeof finalContainer.hasChildNodes,
        containerType: finalContainer.constructor.name,
      });
      throw new Error(`Container-Element ist kein gültiges HTMLElement. hasChildNodes ist: ${typeof finalContainer.hasChildNodes}`);
    }
    
    // Prüfe, ob das Element wirklich im DOM ist
    if (!finalContainer.isConnected) {
      console.error('❌ [reCAPTCHA] Container-Element ist nicht im DOM');
      throw new Error('Container-Element ist nicht im DOM');
    }
    
    console.log('🔵 [reCAPTCHA] Erstelle RecaptchaVerifier mit Container...');
    console.log('🔵 [reCAPTCHA] Container vor Verifier-Erstellung:', {
      containerId: finalContainer.id,
      hasChildNodes: finalContainer.hasChildNodes(),
      innerHTML: finalContainer.innerHTML,
      children: finalContainer.children.length,
      elementType: finalContainer.constructor.name,
    });
    
    // WICHTIG: RecaptchaVerifier erstellt das reCAPTCHA Widget selbst
    // Wir dürfen NICHT grecaptcha.render() vorher aufrufen, da das zu Konflikten führt
    // Verwende das Container-Element direkt, ohne vorher grecaptcha.render() aufzurufen
    
    console.log('🔵 [reCAPTCHA] Erstelle RecaptchaVerifier mit Workaround für Firebase 10.14.1 Bug...');
    
    // WICHTIG: Bekannter Bug in Firebase 10.14.1: RecaptchaVerifier hat Probleme mit Container-Elementen
    // Workaround: Versuche zuerst OHNE Container (für invisible reCAPTCHA sollte das funktionieren)
    // Falls das nicht funktioniert, verwende einen anderen Ansatz
    
    try {
      // Methode 1: Versuche OHNE Container (für invisible reCAPTCHA)
      // Für invisible reCAPTCHA: new RecaptchaVerifier(auth, { size: 'invisible' })
      console.log('🔵 [reCAPTCHA] Versuche Verifier OHNE Container (invisible)...');
      recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaConfig as any);
      console.log('✅ [reCAPTCHA] Verifier erfolgreich OHNE Container erstellt');
    } catch (noContainerError) {
      console.warn('⚠️  [reCAPTCHA] Fehler ohne Container, versuche mit Element:', noContainerError);
      
      // Methode 2: Verwende das Element direkt, aber stelle sicher, dass es wirklich ein HTMLElement ist
      if (!(finalContainer instanceof HTMLElement)) {
        throw new Error('Container-Element ist kein gültiges HTMLElement');
      }
      
      // WICHTIG: Erstelle eine neue Referenz zum Element, um sicherzustellen, dass es nicht durch Proxy modifiziert wurde
      const containerRef = finalContainer.cloneNode(false) as HTMLElement;
      containerRef.id = containerIdToUse + '-ref';
      containerRef.style.cssText = finalContainer.style.cssText;
      
      // Ersetze das alte Element
      finalContainer.replaceWith(containerRef);
      
      // Warte kurz
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Hole das neue Element
      const finalRef = document.getElementById(containerRef.id);
      if (!finalRef || !(finalRef instanceof HTMLElement)) {
        throw new Error('Container-Referenz konnte nicht erstellt werden');
      }
      
      try {
        // Für invisible reCAPTCHA mit Container: new RecaptchaVerifier(auth, container, { size: 'invisible' })
        console.log('🔵 [reCAPTCHA] Versuche Verifier mit Element-Referenz...');
        recaptchaVerifier = new RecaptchaVerifier(auth, finalRef, recaptchaConfig as any);
        console.log('✅ [reCAPTCHA] Verifier erfolgreich mit Element-Referenz erstellt');
      } catch (refError) {
        console.error('❌ [reCAPTCHA] Alle Methoden fehlgeschlagen:', refError);
        throw new Error(`Fehler beim Erstellen des RecaptchaVerifier: ${refError instanceof Error ? refError.message : String(refError)}. Dies ist ein bekannter Bug in Firebase 10.14.1. Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.`);
      }
    }

    return recaptchaVerifier;
  } catch (error) {
    console.error('❌ [reCAPTCHA] Fehler beim Erstellen des reCAPTCHA Verifiers:', error);
    console.error('❌ [reCAPTCHA] Fehler-Details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
    // Cleanup bei Fehler
    const container = document.getElementById(containerId || 'recaptcha-invisible-container');
    if (container) {
      container.remove();
    }
    
    throw error;
  }
}

/**
 * Gibt den aktuellen reCAPTCHA Verifier zurück.
 */
export function getRecaptchaVerifier(): RecaptchaVerifierType | null {
  return recaptchaVerifier;
}

/**
 * Räumt den reCAPTCHA Verifier auf.
 * Sollte aufgerufen werden, wenn der Verifier nicht mehr benötigt wird.
 */
export function clearRecaptchaVerifier(): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (error) {
      console.warn('Fehler beim Aufräumen des reCAPTCHA Verifiers:', error);
    }
    recaptchaVerifier = null;
  }
  
  // Entferne auch das Container-Element
  const container = document.getElementById('recaptcha-invisible-container');
  if (container) {
    container.remove();
  }
  
  // WICHTIG: Aktiviere App Check wieder, nachdem Phone Auth abgeschlossen ist
  import('./app-check.js').then(({ enableAppCheck }) => {
    enableAppCheck();
  }).catch(() => {
    // Ignoriere Fehler beim Aktivieren von App Check
  });
}
