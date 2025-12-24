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
} from './api';
import styles from './DevStaffAdminPage.module.css';

const AVAILABLE_PERMISSIONS = [
  { id: 'verification.review', label: 'Verifizierungen prüfen' },
  { id: 'modules.manage', label: 'Module verwalten' },
];

export function DevStaffAdminPage() {
  const [devStaff, setDevStaff] = useState<DevStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateDevStaffRequest>({
    email: '',
    displayName: '',
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
      await createDevStaff(formData);
      setShowCreateForm(false);
      setFormData({ email: '', displayName: '', permissions: [] });
      await loadDevStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  };

  const handleUpdatePermissions = async (uid: string, permissions: string[]) => {
    try {
      await updateDevStaffPermissions(uid, { permissions });
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

      {!loading && !error && (
        <>
          <div className={styles.actions}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
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
                    <h3 className={styles.devStaffName}>{staff.displayName}</h3>
                    <p className={styles.devStaffEmail}>{staff.email}</p>
                    <p className={styles.devStaffDate}>
                      Erstellt: {new Date(staff.createdAt).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <div className={styles.devStaffPermissions}>
                    {editingUid === staff.uid ? (
                      <div className={styles.editPermissions}>
                        {AVAILABLE_PERMISSIONS.map((permission) => (
                          <label key={permission.id} className={styles.permissionItem}>
                            <input
                              type="checkbox"
                              checked={staff.permissions.includes(permission.id)}
                              onChange={(e) => {
                                const newPermissions = e.target.checked
                                  ? [...staff.permissions, permission.id]
                                  : staff.permissions.filter((p) => p !== permission.id);
                                handleUpdatePermissions(staff.uid, newPermissions);
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

