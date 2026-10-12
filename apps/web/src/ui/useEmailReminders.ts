import { useCallback, useEffect, useState } from "react";
import { api } from "../live/api";

type Setting = { emailReminders: boolean };

/**
 * Whether reminders from other members also arrive by email. Unlike the
 * on-device Notices switch, this is saved to the account, and the reminder
 * emails' unsubscribe link turns it off. `enabled` is null until loaded.
 */
export function useEmailReminders(userId: string | undefined) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    let current = true;
    setEnabled(null);
    setError("");
    api<Setting>("/preferences").then(
      (setting) => { if (current) setEnabled(setting.emailReminders); },
      () => { if (current) setError("Your email setting couldn’t be loaded. Reload to try again."); },
    );
    return () => { current = false; };
  }, [userId]);

  const save = useCallback(async (next: boolean) => {
    setSaving(true);
    setError("");
    try {
      // Saving a choice twice is harmless, so a retry after a lost reply is safe.
      const setting = await api<Setting>("/preferences", { method: "PUT", body: JSON.stringify({ emailReminders: next }) });
      setEnabled(setting.emailReminders);
    } catch {
      setError("Your email setting wasn’t confirmed. Try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  return { enabled, saving, error, save };
}
