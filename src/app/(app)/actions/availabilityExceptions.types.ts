/**
 * A one-off blocked date (vacation / appointment / sick day) layered on top of
 * the recurring weekly rules. `date` is a plain "YYYY-MM-DD" calendar key so the
 * UI never has to think about timezones.
 */
export interface AvailabilityExceptionDTO {
  id: string;
  employeeId: string;
  /** "YYYY-MM-DD" */
  date: string;
  reason: string | null;
}

/** Providers an admin may manage availability for (the picker in the tab). */
export interface AvailabilityEmployeeDTO {
  id: string;
  name: string;
}
