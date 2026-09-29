/**
 * Outreach logs service — logs are persisted server-side in encrypted local storage.
 * Firebase is strictly used for Google authentication only.
 */
import { authFetch } from '../services/api';

export async function saveLogsToFirestore() {
  // Logs are automatically persisted on the server during dispatch
  return;
}

export async function fetchLogsFromFirestore() {
  try {
    const res = await authFetch('/api/logs');
    if (res.ok) return res.json();
  } catch {}
  return [];
}

export async function clearLogsFromFirestore() {
  try {
    await authFetch('/api/logs', { method: 'DELETE' });
  } catch {}
}
