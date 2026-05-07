export type NotificationPrefs = {
  newJob: boolean;
  jobReminder: boolean;
  payProcessed: boolean;
  ratingReceived: boolean;
  documentToSign: boolean;
  trainingAssigned: boolean;
  multiplierChange: boolean;
  lowInventory: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newJob: true,
  jobReminder: true,
  payProcessed: true,
  ratingReceived: true,
  documentToSign: true,
  trainingAssigned: true,
  multiplierChange: true,
  lowInventory: true,
};
