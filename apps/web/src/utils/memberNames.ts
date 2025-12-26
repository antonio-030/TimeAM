/**
 * Utility-Funktionen für die Anzeige von Mitglieder-Namen
 * 
 * Stellt sicher, dass immer Vorname + Nachname angezeigt wird (falls vorhanden),
 * um Verwechslungen zu vermeiden.
 */

import type { Member } from '@timeam/shared';

/**
 * Gibt den vollständigen Namen eines Mitglieds zurück.
 * Priorität: Vorname + Nachname > Display-Name > E-Mail
 */
export function getMemberFullName(member: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email: string;
}): string {
  // Wenn Vorname UND Nachname vorhanden sind, diese verwenden
  if (member.firstName && member.lastName) {
    return `${member.firstName} ${member.lastName}`.trim();
  }
  
  // Fallback zu Display-Name
  if (member.displayName) {
    return member.displayName;
  }
  
  // Letzter Fallback: E-Mail-Benutzername
  return member.email.split('@')[0];
}

/**
 * Gibt Initialen für ein Mitglied zurück.
 * Verwendet Vorname + Nachname falls vorhanden, sonst Display-Name oder E-Mail.
 */
export function getMemberInitials(member: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email: string;
}): string {
  // Wenn Vorname UND Nachname vorhanden sind, Initialen daraus bilden
  if (member.firstName && member.lastName) {
    return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  }
  
  // Fallback: Aus Display-Name
  if (member.displayName) {
    const parts = member.displayName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return member.displayName.substring(0, 2).toUpperCase();
  }
  
  // Letzter Fallback: Aus E-Mail
  return member.email.substring(0, 2).toUpperCase();
}

/**
 * Gibt den vollständigen Namen mit E-Mail zurück (für Tooltips/Details).
 */
export function getMemberNameWithEmail(member: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email: string;
}): string {
  const name = getMemberFullName(member);
  return `${name} (${member.email})`;
}

