/**
 * Shift Document List
 *
 * Zeigt alle Dokumente einer Schicht an und ermöglicht Upload/Download.
 */

import { useState, useRef } from 'react';
import { useShiftDocuments } from './hooks';
import { useAuth } from '../../core/auth';
import { useTenant } from '../../core/tenant';
import type { ShiftDocument } from '@timeam/shared';
import styles from './ShiftPool.module.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string): string {
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  return '📎';
}

// =============================================================================
// Components
// =============================================================================

interface ShiftDocumentListProps {
  shiftId: string;
  canView: boolean;
  canUpload: boolean;
}

export function ShiftDocumentList({
  shiftId,
  canView,
  canUpload,
}: ShiftDocumentListProps) {
  const { user } = useAuth();
  const { role } = useTenant();
  const { documents, loading, error, refresh, uploadDocument, downloadDocument, deleteDocument } =
    useShiftDocuments(shiftId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminOrManager = role === 'admin' || role === 'manager';

  if (!canView && !isAdminOrManager) {
    return null;
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validierung
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Nur JPG, PNG und PDF-Dateien sind erlaubt');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError('Datei ist zu groß (max. 10MB)');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await uploadDocument(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: ShiftDocument) => {
    try {
      await downloadDocument(document.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Download');
    }
  };

  const handleDelete = async (document: ShiftDocument) => {
    if (!confirm(`Möchtest du das Dokument "${document.fileName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    try {
      await deleteDocument(document.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  return (
    <div className={styles.documentsSection}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>📎 Dokumente</h3>
        {canUpload && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              className={`${styles.button} ${styles.buttonSmall} ${styles.buttonPrimary}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ Wird hochgeladen...' : '📤 Dokument hochladen'}
            </button>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}
      {uploadError && <div className={styles.error}>⚠️ {uploadError}</div>}

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>Dokumente werden geladen...</p>
        </div>
      )}

      {!loading && documents.length === 0 && (
        <div className={styles.empty}>
          <p>Noch keine Dokumente vorhanden</p>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className={styles.documentsList}>
          {documents.map((document) => (
            <div key={document.id} className={styles.documentCard}>
              <div className={styles.documentIcon}>{getFileIcon(document.fileType)}</div>
              <div className={styles.documentInfo}>
                <div className={styles.documentName}>{document.fileName}</div>
                <div className={styles.documentMeta}>
                  <span>{formatFileSize(document.fileSize)}</span>
                  <span>•</span>
                  <span>{formatDate(document.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <button
                  className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`}
                  onClick={() => handleDownload(document)}
                >
                  ⬇️ Download
                </button>
                {(canUpload || isAdminOrManager) && (
                  <button
                    className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
                    onClick={() => handleDelete(document)}
                    title="Dokument löschen"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

