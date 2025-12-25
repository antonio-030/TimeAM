/**
 * Notifications Service
 *
 * Firestore-Operationen für Benachrichtigungen.
 */

import { getAdminFirestore } from '../../core/firebase/index.js';
import { FieldValue } from 'firebase-admin/firestore';
import type { Notification, NotificationType } from '@timeam/shared';
import type { NotificationDoc, CreateNotificationParams } from './types.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Konvertiert NotificationDoc zu API Response.
 */
function toResponse(id: string, doc: NotificationDoc): Notification {
  return {
    id,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    read: doc.read,
    createdAt: doc.createdAt.toDate().toISOString(),
    ref: doc.ref,
    link: doc.link,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Erstellt eine neue Benachrichtigung.
 */
export async function createNotification(
  tenantId: string,
  params: CreateNotificationParams
): Promise<Notification> {
  const db = getAdminFirestore();

  const notificationRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('notifications')
    .doc();

  const notificationData: Record<string, unknown> = {
    type: params.type,
    title: params.title,
    message: params.message,
    read: false,
    recipientUid: params.recipientUid,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (params.ref) {
    notificationData.ref = params.ref;
  }
  if (params.link) {
    notificationData.link = params.link;
  }

  await notificationRef.set(notificationData);

  // Zurücklesen
  const savedDoc = await notificationRef.get();
  return toResponse(notificationRef.id, savedDoc.data() as NotificationDoc);
}

/**
 * Erstellt Benachrichtigungen für mehrere Empfänger.
 */
export async function createNotificationsForUsers(
  tenantId: string,
  recipientUids: string[],
  params: Omit<CreateNotificationParams, 'recipientUid'>
): Promise<void> {
  const db = getAdminFirestore();
  const batch = db.batch();

  for (const uid of recipientUids) {
    const notificationRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('notifications')
      .doc();

    const notificationData: Record<string, unknown> = {
      type: params.type,
      title: params.title,
      message: params.message,
      read: false,
      recipientUid: uid,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (params.ref) {
      notificationData.ref = params.ref;
    }
    if (params.link) {
      notificationData.link = params.link;
    }

    batch.set(notificationRef, notificationData);
  }

  await batch.commit();
}

/**
 * Lädt Benachrichtigungen für einen User.
 */
export async function getNotificationsForUser(
  tenantId: string,
  uid: string,
  options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const db = getAdminFirestore();
  const { limit = 50, unreadOnly = false } = options;

  // Query ohne orderBy (kein Composite Index nötig)
  let query = db
    .collection('tenants')
    .doc(tenantId)
    .collection('notifications')
    .where('recipientUid', '==', uid);

  if (unreadOnly) {
    query = query.where('read', '==', false);
  }

  const snapshot = await query.get();

  // Client-seitig sortieren (neueste zuerst)
  let notifications = snapshot.docs
    .map((doc) => toResponse(doc.id, doc.data() as NotificationDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  // Unread Count berechnen
  const unreadCount = snapshot.docs.filter(
    (doc) => !(doc.data() as NotificationDoc).read
  ).length;

  return { notifications, unreadCount };
}

/**
 * Zählt ungelesene Benachrichtigungen.
 */
export async function getUnreadCount(
  tenantId: string,
  uid: string
): Promise<number> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('notifications')
    .where('recipientUid', '==', uid)
    .where('read', '==', false)
    .get();

  return snapshot.size;
}

/**
 * Markiert eine Benachrichtigung als gelesen.
 */
export async function markAsRead(
  tenantId: string,
  notificationId: string,
  uid: string
): Promise<Notification | null> {
  const db = getAdminFirestore();

  const notificationRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('notifications')
    .doc(notificationId);

  const notificationSnap = await notificationRef.get();

  if (!notificationSnap.exists) {
    return null;
  }

  const data = notificationSnap.data() as NotificationDoc;

  // Nur eigene Benachrichtigungen markieren
  if (data.recipientUid !== uid) {
    return null;
  }

  await notificationRef.update({ read: true });

  return toResponse(notificationId, { ...data, read: true });
}

/**
 * Markiert alle Benachrichtigungen eines Users als gelesen.
 */
export async function markAllAsRead(
  tenantId: string,
  uid: string
): Promise<number> {
  const db = getAdminFirestore();

  const snapshot = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('notifications')
    .where('recipientUid', '==', uid)
    .where('read', '==', false)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();

  return snapshot.size;
}

/**
 * Löscht eine Benachrichtigung.
 */
export async function deleteNotification(
  tenantId: string,
  notificationId: string,
  uid: string
): Promise<boolean> {
  const db = getAdminFirestore();

  const notificationRef = db
    .collection('tenants')
    .doc(tenantId)
    .collection('notifications')
    .doc(notificationId);

  const notificationSnap = await notificationRef.get();

  if (!notificationSnap.exists) {
    return false;
  }

  const data = notificationSnap.data() as NotificationDoc;

  // Nur eigene Benachrichtigungen löschen
  if (data.recipientUid !== uid) {
    return false;
  }

  await notificationRef.delete();
  return true;
}
