/**
 * Verification Upload Form
 *
 * Komponente zum Hochladen des Gewerbescheins für Freelancer.
 */

import { useState, useRef } from 'react';
import {
  uploadVerificationDocument,
  getVerificationStatus,
  type VerificationStatus,
} from '../modules/freelancer/api';
import styles from './VerificationUploadForm.module.css';

interface VerificationUploadFormProps {
  currentStatus?: VerificationStatus;
  onStatusChange?: (status: VerificationStatus) => void;
}

export function VerificationUploadForm({
  currentStatus,
  onStatusChange,
}: VerificationUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validierung: Dateityp
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Nur JPG, PNG und PDF-Dateien sind erlaubt');
      return;
    }

    // Validierung: Dateigröße (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError('Die Datei ist zu groß. Maximale Größe: 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine Datei aus');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      await uploadVerificationDocument(file);
      setSuccess(true);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Status neu laden
      const statusResponse = await getVerificationStatus();
      if (statusResponse.verificationStatus && onStatusChange) {
        onStatusChange(statusResponse.verificationStatus);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Hochladen';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusMessage = () => {
    switch (currentStatus) {
      case 'pending':
        return 'Ihr Gewerbeschein wird geprüft. Sie erhalten eine Benachrichtigung, sobald die Prüfung abgeschlossen ist.';
      case 'approved':
        return 'Ihr Gewerbeschein wurde verifiziert. Sie können jetzt Rechnungen schreiben.';
      case 'rejected':
        return 'Ihr Gewerbeschein wurde abgelehnt. Bitte laden Sie ein neues Dokument hoch.';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();

  // Wenn bereits approved, kein Upload möglich
  if (currentStatus === 'approved') {
    return (
      <div className={styles.container}>
        <div className={styles.statusApproved}>
          <span className={styles.statusIcon}>✅</span>
          <div>
            <h3>Verifiziert</h3>
            <p>{statusMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3>Gewerbeschein hochladen</h3>
      <p className={styles.description}>
        Laden Sie Ihren Gewerbeschein hoch, um verifiziert zu werden. Nach der Prüfung können Sie Rechnungen schreiben.
      </p>

      {statusMessage && (
        <div className={`${styles.statusMessage} ${styles[`status${currentStatus?.charAt(0).toUpperCase() + currentStatus?.slice(1)}`] || ''}`}>
          {statusMessage}
        </div>
      )}

      <div className={styles.uploadSection}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={handleFileSelect}
          disabled={uploading || currentStatus === 'pending'}
          className={styles.fileInput}
        />
        {file && (
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {success && (
        <div className={styles.success}>
          Datei erfolgreich hochgeladen! Die Prüfung wird in Kürze durchgeführt.
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading || currentStatus === 'pending'}
        className={styles.uploadButton}
      >
        {uploading ? 'Wird hochgeladen...' : 'Gewerbeschein hochladen'}
      </button>
    </div>
  );
}

