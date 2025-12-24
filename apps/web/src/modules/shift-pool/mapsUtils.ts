/**
 * Maps Utilities
 *
 * Helper-Funktionen für Google Maps Integration.
 */

import type { ShiftLocation } from '@timeam/shared';

/**
 * Öffnet eine Adresse in Google Maps (neuer Tab).
 * 
 * @param location - Die Location mit Adresse und optionalen Koordinaten
 */
export function openAddressInMaps(location: ShiftLocation): void {
  if (!location.address) {
    return;
  }

  let mapsUrl: string;

  // Wenn Koordinaten vorhanden sind, diese verwenden (genauer)
  if (location.latitude !== undefined && location.longitude !== undefined) {
    mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  } else {
    // Sonst Adresse als Suchbegriff verwenden
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
  }

  window.open(mapsUrl, '_blank', 'noopener,noreferrer');
}

