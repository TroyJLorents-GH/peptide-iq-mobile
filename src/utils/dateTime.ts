/** Convert a Date to local datetime-local input format (YYYY-MM-DDTHH:MM) */
export function toLocalDateTimeString(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
