/**
 * Firestore-backed outreach log persistence for cloud-deployed users.
 *
 * Document path: users/{uid}/outreachLogs/{logId}
 *
 * For cloud users (Firebase Auth active), logs are stored per-user in Firestore.
 * For self-hosted users (no Firebase), the existing /api/logs backend endpoint is used.
 */
import {
  collection,
  getDocs,
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

const logsCollection = (uid) => collection(db, 'users', uid, 'outreachLogs');

/**
 * Save a batch of campaign log entries to Firestore.
 * Called after campaign completion with the logs array from the SSE finished event.
 */
export async function saveLogsToFirestore(uid, logEntries) {
  if (!uid || !Array.isArray(logEntries) || logEntries.length === 0) return;

  const batch = writeBatch(db);
  for (const entry of logEntries) {
    const docRef = doc(logsCollection(uid));
    batch.set(docRef, {
      ...entry,
      savedAt: serverTimestamp()
    });
  }
  await batch.commit();
}

/**
 * Fetch all outreach logs for a user from Firestore.
 * Returns newest-first array matching the same schema as /api/logs.
 */
export async function fetchLogsFromFirestore(uid) {
  if (!uid) return [];
  const q = query(logsCollection(uid), orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), _firestoreId: d.id }));
}

/**
 * Clear all outreach logs for a user from Firestore.
 */
export async function clearLogsFromFirestore(uid) {
  if (!uid) return;
  const snap = await getDocs(logsCollection(uid));
  if (snap.empty) return;

  const batch = writeBatch(db);
  for (const d of snap.docs) {
    batch.delete(d.ref);
  }
  await batch.commit();
}
