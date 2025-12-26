/**
 * Dev Staff Admin Page
 *
 * Verwaltung von Dev-Mitarbeitern (nur Super-Admin).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getDevStaff,
  createDevStaff,
  updateDevStaffPermissions,
  deleteDevStaff,
  type DevStaff,
  type CreateDevStaffRequest,
  type DevStaffRole,
} from './api';
import { useSuperAdminCheck } from '../admin';
import styles from './DevStaffAdminPage.module.css';

const AVAILABLE_PERMISSIONS = [
  { id: 'verification.review', label: 'Verifizierungen prüfen' },
  { id: 'modules.manage', label: 'Module verwalten' },
];

export function DevStaffAdminPage() {
  const { isSuperAdmin } = useSuperAdminCheck();
  const [devStaff, setDevStaff] = useState<DevStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [createdPasswordResetLink, setCreatedPasswordResetLink] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateDevStaffRequest>({
    email: '',
    displayName: '',
    role: 'dev-staff',
    permissions: [],
  });

  const loadDevStaff = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getDevStaff();
      setDevStaff(data.devStaff);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevStaff();
  }, [loadDevStaff]);

  const handleCreate = async () => {
    if (!formData.email || !formData.displayName || formData.permissions.length === 0) {
      alert('Bitte füllen Sie alle Felder aus und wählen Sie mindestens eine Berechtigung');
      return;
    }

    try {
      const result = await createDevStaff(formData);
      if (result.devStaff.passwordResetLink) {
        setCreatedPasswordResetLink(result.devStaff.passwordResetLink);
      }
      setShowCreateForm(false);
      setFormData({ email: '', displayName: '', role: 'dev-staff', permissions: [] });
      await loadDevStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  };

  const handleUpdatePermissions = async (uid: string, permissions: string[], role?: DevStaffRole) => {
    try {
      await updateDevStaffPermissions(uid, { permissions, role });
      setEditingUid(null);
      await loadDevStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('Dev-Mitarbeiter wirklich entfernen?')) {
      return;
    }

    try {
      await deleteDevStaff(uid);
      await loadDevStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const togglePermission = (permissionId: string) => {
    if (formData.permissions.includes(permissionId)) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter((p) => p !== permissionId),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permissionId],
      });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dev-Mitarbeiter Verwaltung</h1>
        <p className={styles.subtitle}>Verwaltung von Support-Mitarbeitern</p>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadDevStaff} className={styles.retryBtn}>
            Erneut versuchen
          </button>
        </div>
      )}

      {loading && (
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      )}

      {createdPasswordResetLink && (
        <div className={styles.passwordResetLinkBox}>
          <h3>🔗 Password-Reset-Link generiert</h3>
          <p>Bitte senden Sie diesen Link an den neuen Dev-Mitarbeiter, damit er sein Passwort festlegen kann:</p>
          <div className={styles.linkContainer}>
            <input
              type="text"
              value={createdPasswordResetLink}
              readOnly
              className={styles.linkInput}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(createdPasswordResetLink);
                  alert('Link in Zwischenablage kopiert!');
                } catch (err) {
                  alert('Fehler beim Kopieren. Bitte manuell kopieren.');
                }
              }}
              className={styles.copyButton}
            >
              📋 Kopieren
            </button>
          </div>
          <button
            onClick={() => setCreatedPasswordResetLink(null)}
            className={styles.closeButton}
          >
            Schließen
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className={styles.actions}>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setCreatedPasswordResetLink(null); // Reset link when closing form
              }}
              className={styles.createButton}
            >
              {showCreateForm ? '✕ Abbrechen' : '+ Neuer Dev-Mitarbeiter'}
            </button>
          </div>

          {showCreateForm && (
            <div className={styles.createForm}>
              <h2>Neuer Dev-Mitarbeiter</h2>
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  E-Mail *
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={styles.input}
                  placeholder="dev@example.com"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="displayName" className={styles.label}>
                  Name *
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className={styles.input}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="role" className={styles.label}>
                  Rolle *
                </label>
                <select
                  id="role"
                  value={formData.role || 'dev-staff'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as DevStaffRole })}
                  className={styles.input}
                  disabled={!isSuperAdmin} // Nur Super-Admins können super-admin Rolle setzen
                >
                  <option value="dev-staff">Dev-Staff</option>
                  {isSuperAdmin && <option value="super-admin">Super-Admin</option>}
                </select>
                {!isSuperAdmin && (
                  <p className={styles.hint}>
                    Nur Super-Admins können die Super-Admin-Rolle vergeben
                  </p>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Berechtigungen *</label>
                <div className={styles.permissionsList}>
                  {AVAILABLE_PERMISSIONS.map((permission) => (
                    <label key={permission.id} className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                      />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.formActions}>
                <button onClick={handleCreate} className={styles.submitButton}>
                  Erstellen
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ email: '', displayName: '', permissions: [] });
                  }}
                  className={styles.cancelButton}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className={styles.devStaffList}>
            {devStaff.length === 0 ? (
              <div className={styles.empty}>
                <p>Keine Dev-Mitarbeiter vorhanden</p>
              </div>
            ) : (
              devStaff.map((staff) => (
                <div key={staff.uid} className={styles.devStaffCard}>
                  <div className={styles.devStaffInfo}>
                    <h3 className={styles.devStaffName}>
                      {staff.displayName}
                      {staff.role === 'super-admin' && (
                        <span className={styles.roleBadge}>🔐 Super-Admin</span>
                      )}
                    </h3>
                    <p className={styles.devStaffEmail}>{staff.email}</p>
                    <p className={styles.devStaffDate}>
                      Erstellt: {new Date(staff.createdAt).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <div className={styles.devStaffPermissions}>
                    {editingUid === staff.uid ? (
                      <div className={styles.editPermissions}>
                        {isSuperAdmin && (
                          <div className={styles.formGroup}>
                            <label htmlFor={`role-${staff.uid}`} className={styles.label}>
                              Rolle
                            </label>
                            <select
                              id={`role-${staff.uid}`}
                              value={staff.role}
                              onChange={(e) => {
                                const newRole = e.target.value as DevStaffRole;
                                handleUpdatePermissions(staff.uid, staff.permissions, newRole);
                              }}
                              className={styles.input}
                              disabled={!isSuperAdmin}
                            >
                              <option value="dev-staff">Dev-Staff</option>
                              {isSuperAdmin && <option value="super-admin">Super-Admin</option>}
                            </select>
                          </div>
                        )}
                        {AVAILABLE_PERMISSIONS.map((permission) => (
                          <label key={permission.id} className={styles.permissionItem}>
                            <input
                              type="checkbox"
                              checked={staff.permissions.includes(permission.id)}
                              onChange={(e) => {
                                const newPermissions = e.target.checked
                                  ? [...staff.permissions, permission.id]
                                  : staff.permissions.filter((p) => p !== permission.id);
                                handleUpdatePermissions(staff.uid, newPermissions, staff.role);
                              }}
                            />
                            <span>{permission.label}</span>
                          </label>
                        ))}
                        <button
                          onClick={() => setEditingUid(null)}
                          className={styles.cancelButton}
                        >
                          Fertig
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={styles.permissionsDisplay}>
                          {staff.permissions.length > 0 ? (
                            staff.permissions.map((permId) => {
                              const perm = AVAILABLE_PERMISSIONS.find((p) => p.id === permId);
                              return (
                                <span key={permId} className={styles.permissionBadge}>
                                  {perm?.label || permId}
                                </span>
                              );
                            })
                          ) : (
                            <span className={styles.noPermissions}>Keine Berechtigungen</span>
                          )}
                        </div>
                        <div className={styles.devStaffActions}>
                          <button
                            onClick={() => setEditingUid(staff.uid)}
                            className={styles.editButton}
                          >
                            ✏️ Bearbeiten
                          </button>
                          <button
                            onClick={() => handleDelete(staff.uid)}
                            className={styles.deleteButton}
                          >
                            🗑️ Löschen
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

