/**
 * Notification service — local daily reminders.
 *
 * Provides helpers to:
 *  - Request OS notification permission
 *  - Schedule a daily repeating local notification at a given hour/minute
 *  - Cancel only the app's scheduled reminder (by tracked ID)
 *  - Persist/restore the user's reminder preference (enabled + time) via AsyncStorage
 *
 * All scheduling is local and works offline — no backend required.
 *
 * Design note: we track the scheduled notification identifier in AsyncStorage
 * alongside the preference so that only the app's own reminder is cancelled
 * when the user disables or reschedules — leaving any other scheduled
 * notifications (added by future features) untouched.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "reframe_reminder_v1";
const NOTIFICATION_ID_KEY = "reframe_reminder_notif_id_v1";

export interface ReminderPreference {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_PREFERENCE: ReminderPreference = {
  enabled: false,
  hour: 20,
  minute: 0,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Request notification permission from the OS. Returns true if granted. */
export async function requestPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    return true;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminder", {
      name: "Daily Reminder",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Cancel only the app's tracked daily reminder notification. */
export async function cancelReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
    }
  } catch {
  }
}

/**
 * Schedule a daily repeating notification at the given hour and minute.
 * Cancels any previously tracked reminder first, then stores the new ID.
 */
export async function scheduleReminder(hour: number, minute: number): Promise<void> {
  await cancelReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to check in ✨",
      body: "Time to check in with your thoughts ✨",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  try {
    await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
  } catch {
  }
}

/** Load the saved reminder preference from AsyncStorage. */
export async function loadReminderPreference(): Promise<ReminderPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as ReminderPreference;
    }
  } catch {
  }
  return { ...DEFAULT_PREFERENCE };
}

/** Persist the reminder preference to AsyncStorage. */
export async function saveReminderPreference(pref: ReminderPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
  }
}

/**
 * Apply the saved reminder preference on app launch.
 * - If enabled: re-requests permission (in case it was revoked) and reschedules.
 * - If disabled: defensively cancels any stale tracked reminder.
 */
export async function applyReminderPreference(): Promise<void> {
  const pref = await loadReminderPreference();

  if (!pref.enabled) {
    await cancelReminder();
    return;
  }

  const granted = await requestPermission();
  if (!granted) {
    await saveReminderPreference({ ...pref, enabled: false });
    await cancelReminder();
    return;
  }

  await scheduleReminder(pref.hour, pref.minute);
}
