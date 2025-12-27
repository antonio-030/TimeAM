/**
 * Checkout Cancel Page
 *
 * Wird aufgerufen, wenn der User den Stripe Checkout abbricht.
 * Loggt den User aus und speichert den Checkout-Kontext für späteren Login.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth';
import styles from './CheckoutCancelPage.module.css';

export function CheckoutCancelPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    async function handleCancel() {
      // Wenn User eingeloggt ist, ausloggen
      if (user) {
        try {
          await signOut();
        } catch (err) {
          console.error('Fehler beim Abmelden:', err);
        }
      }

      // Kurze Verzögerung, damit der Logout-Prozess abgeschlossen ist
      setTimeout(() => {
        navigate('/login?checkout=canceled', { replace: true });
      }, 500);
    }

    handleCancel();
  }, [user, signOut, navigate]);

  return (
    <div className={styles.cancelPage}>
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Checkout abgebrochen...</p>
        </div>
      </div>
    </div>
  );
}

