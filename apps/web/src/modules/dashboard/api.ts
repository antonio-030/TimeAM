/**
 * Dashboard API Client
 * 
 * Lädt Dashboard-Daten für alle Rollen.
 * Robustes Error-Handling für fehlende APIs.
 */

import { apiGet } from '../../core/api';

// ============= Types =============

/** Zeiterfassungs-Status */
export interface TimeTrackingStatus {
  isRunning: boolean;
  runningEntry: {
    id: string;
    clockIn: string;
    durationMinutes: number;
  } | null;
  today: {
    totalMinutes: number;
    entriesCount: number;
  };
}

/** Team-Mitglied Status */
export interface TeamMemberStatus {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'manager' | 'employee';
  isOnline: boolean;
  lastActivity?: string;
  todayMinutes: number;
}

/** Dashboard-Statistiken */
export interface DashboardStats {
  // Persönliche Stats
  todayWorkedMinutes: number;
  weekWorkedMinutes: number;
  monthWorkedMinutes: number;
  
  // Admin/Manager Stats (optional)
  teamSize?: number;
  activeNow?: number;
  pendingApprovals?: number;
  openShifts?: number;
  
  // Vergleich (optional)
  weekChange?: number;
}

/** Schicht für Dashboard */
export interface DashboardShift {
  id: string;
  title: string;
  location: { name: string; address?: string };
  startsAt: string;
  endsAt: string;
  status: string;
  assignmentStatus?: string;
}

// ============= API Functions =============

/**
 * Lädt Zeiterfassungs-Status.
 */
export async function getTimeStatus(): Promise<TimeTrackingStatus> {
  try {
    return await apiGet<TimeTrackingStatus>('/api/time-tracking/status');
  } catch (error) {
    // Fallback wenn API nicht verfügbar
    console.debug('Time tracking status not available:', error);
    return {
      isRunning: false,
      runningEntry: null,
      today: { totalMinutes: 0, entriesCount: 0 },
    };
  }
}

/**
 * Lädt Team-Mitglieder (nur Admin/Manager).
 */
export async function getTeamMembers(): Promise<TeamMemberStatus[]> {
  try {
    const response = await apiGet<{ members: Array<{
      uid: string;
      email: string;
      displayName?: string;
      role: 'admin' | 'manager' | 'employee';
    }> }>('/api/members');
    
    // Transformiere zu TeamMemberStatus
    return (response.members || []).map(m => ({
      uid: m.uid,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      isOnline: false,
      todayMinutes: 0,
    }));
  } catch (error) {
    console.debug('Team members not available:', error);
    return [];
  }
}

/**
 * Lädt Dashboard-Widgets aus Reports (wenn verfügbar).
 */
export async function getDashboardWidgets(): Promise<DashboardStats> {
  try {
    const response = await apiGet<{ 
      success: boolean;
      data: {
        todayHours?: { value: number };
        weekHours?: { value: number };
        monthHours?: { value: number };
        teamMembers?: { value: number };
        activeNow?: { value: number };
        pendingApprovals?: { value: number };
        openShifts?: { value: number };
      };
    }>('/api/reports/dashboard');
    
    const data = response.data || {};
    return {
      todayWorkedMinutes: Math.round((data.todayHours?.value || 0) * 60),
      weekWorkedMinutes: Math.round((data.weekHours?.value || 0) * 60),
      monthWorkedMinutes: Math.round((data.monthHours?.value || 0) * 60),
      teamSize: data.teamMembers?.value,
      activeNow: data.activeNow?.value,
      pendingApprovals: data.pendingApprovals?.value,
      openShifts: data.openShifts?.value,
    };
  } catch (error) {
    // Reports-Modul nicht aktiviert oder Fehler
    console.debug('Dashboard widgets not available:', error);
    return {
      todayWorkedMinutes: 0,
      weekWorkedMinutes: 0,
      monthWorkedMinutes: 0,
    };
  }
}

/**
 * Lädt die zugewiesenen Schichten des Nutzers.
 */
export async function getMyShifts(): Promise<DashboardShift[]> {
  try {
    const response = await apiGet<{ shifts: Array<{
      id: string;
      title: string;
      location: { name: string; address?: string };
      startsAt: string;
      endsAt: string;
      status: string;
      assignmentStatus?: string;
    }>; count: number }>('/api/shift-pool/my-shifts');
    
    return (response.shifts || []).map(s => ({
      id: s.id,
      title: s.title,
      location: s.location,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      assignmentStatus: s.assignmentStatus,
    }));
  } catch (error) {
    console.debug('My shifts not available:', error);
    return [];
  }
}

/**
 * Lädt offene Schichten aus dem Pool.
 */
export async function getOpenShifts(): Promise<DashboardShift[]> {
  try {
    const response = await apiGet<{ shifts: Array<{
      id: string;
      title: string;
      location: { name: string; address?: string };
      startsAt: string;
      endsAt: string;
      status: string;
    }>; count: number }>('/api/shift-pool/pool');
    
    return (response.shifts || []).slice(0, 5).map(s => ({
      id: s.id,
      title: s.title,
      location: s.location,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
    }));
  } catch (error) {
    console.debug('Open shifts not available:', error);
    return [];
  }
}
