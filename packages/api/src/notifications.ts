import { supabase } from './client';

export interface AppNotification {
  id: string;
  type: 'expense_added' | 'payment_made' | 'payment_overdue';
  title: string;
  description: string;
  created_at: string;
  read: boolean;
  expense_id?: string;
}

export async function getNotifications(
  groupId: string,
): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('fn_get_group_notifications', {
    p_group_id: groupId,
  });

  if (error) throw error;

  return (data ?? []) as AppNotification[];
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { user_id: userId, notification_id: notificationId },
      { onConflict: 'user_id,notification_id' },
    );
  if (error) throw error;
}

/**
 * Mark all current notifications as read.
 */
export async function markAllNotificationsRead(
  userId: string,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return;

  const rows = notificationIds.map((nId) => ({
    user_id: userId,
    notification_id: nId,
  }));

  const { error } = await supabase
    .from('notification_reads')
    .upsert(rows, { onConflict: 'user_id,notification_id' });
  if (error) throw error;
}
