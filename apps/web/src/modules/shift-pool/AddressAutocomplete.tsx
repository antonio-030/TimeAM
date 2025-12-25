/**
 * Address Autocomplete Component
 *
 * Google Places Autocomplete für Adresseingabe bei Schichten.
 * 
 * Hinweis: Verwendet google.maps.places.Autocomplete.
 * Die Warnung ist nur eine Empfehlung - die Funktion wird noch unterstützt.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ShiftLocation } from '@timeam/shared';
import styles from './ShiftPool.module.css';

interface AddressAutocompleteProps {
  value: string;
  onChange: (location: Partial<ShiftLocation>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

// Google Maps Types (extern, daher any)
declare global {
  interface Window {
    google?: any;
    loadGooglePlacesScript: (apiKey: string) => Promise<void>;
  }
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Straße, PLZ Ort',
  required = false,
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const lastValueRef = useRef(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // onChange Ref aktualisieren
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Wert synchronisieren wenn von außen geändert (nur wenn wirklich anders)
  useEffect(() => {
    if (inputRef.current && value !== lastValueRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
      lastValueRef.current = value;
    }
  }, [value]);

  // Initialisierung
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError('Google Maps API Key nicht konfiguriert. Bitte VITE_GOOGLE_MAPS_API_KEY in .env setzen.');
      return;
    }

    const inputElement = inputRef.current;
    if (!inputElement || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    // Script laden
    setIsLoading(true);
    
    // Kleine Verzögerung, um sicherzustellen, dass das Element im DOM ist
    setTimeout(() => {
      window
        .loadGooglePlacesScript(apiKey)
        .then(() => {
          // Prüfe nochmal ob Element noch existiert
          if (!inputRef.current || !window.google) {
            setError('Google Places API konnte nicht geladen werden.');
            setIsLoading(false);
            isInitializedRef.current = false;
            return;
          }

          // Prüfe ob Places API verfügbar ist (mit kurzer Verzögerung, da API manchmal noch lädt)
          if (!window.google.maps?.places) {
            // Warte kurz und prüfe nochmal - API lädt manchmal asynchron
            setTimeout(() => {
              if (!window.google.maps?.places) {
                // Keine Fehlermeldung mehr - API könnte trotzdem funktionieren
                setIsLoading(false);
                isInitializedRef.current = false;
                return;
              }
              // API ist jetzt verfügbar, initialisiere
              initializeAutocomplete();
            }, 500);
            return;
          }
          
          initializeAutocomplete();
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Google Places API';
          if (errorMessage.includes('ApiNotActivatedMapError') || errorMessage.includes('ApiNotActivated')) {
            setError('Maps JavaScript API ist nicht aktiviert. Bitte aktiviere sie in der Google Cloud Console.');
          } else {
            setError(errorMessage);
          }
          setIsLoading(false);
          isInitializedRef.current = false;
        });
    }, 100); // 100ms Delay für DOM-Rendering
    
    function initializeAutocomplete() {
      if (!inputRef.current) {
        setIsLoading(false);
        isInitializedRef.current = false;
        return;
      }
      
      try {
        // Autocomplete initialisieren
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current!, {
          types: ['address'],
          componentRestrictions: { country: 'de' },
          fields: ['formatted_address', 'geometry'],
        });

        autocompleteRef.current = autocomplete;

        // Place ausgewählt Event
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (!place.geometry?.location) {
            // Keine gültige Auswahl - ignoriere
            return;
          }

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || '';

          // Wert aktualisieren
          if (inputRef.current) {
            inputRef.current.value = address;
            lastValueRef.current = address;
          }

          onChangeRef.current({
            address: address,
            latitude: lat,
            longitude: lng,
          });

          setError(null);
        });

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Initialisieren des Autocomplete');
        setIsLoading(false);
        isInitializedRef.current = false;
      }
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        try {
          window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        } catch (err) {
          // Ignoriere Fehler beim Cleanup
        }
        autocompleteRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []); // Leeres Dependency-Array - nur einmal initialisieren


  // Manuelle Eingabe - nur für React, Google Autocomplete übernimmt die Kontrolle
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    lastValueRef.current = newValue;
    // Bei manueller Eingabe nur Adresse setzen (keine Koordinaten)
    onChange({ address: newValue });
    setError(null);
  }, [onChange]);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        className={styles.formInput}
        defaultValue={value}
        onChange={handleInputChange}
        placeholder={isLoading ? 'Lade Adressvorschläge...' : placeholder}
        required={required}
        disabled={disabled || isLoading}
        autoComplete="off"
      />
      {error && (
        <div className={styles.error} style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
          ⚠️ {error}
        </div>
      )}
      {!error && !isLoading && (
        <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>
          💡 Tipp: Beginne mit der Eingabe, um Adressvorschläge zu sehen
        </div>
      )}
    </div>
  );
}

