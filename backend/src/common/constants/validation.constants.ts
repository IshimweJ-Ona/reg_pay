// Canonical formats accepted across the app for person identifiers. Kept in
// one place so create-employee.dto.ts, bulk-import-employee.dto.ts, and the
// frontend bulk-import template validator can never drift out of sync.
export const RWANDA_PHONE_REGEX = /^\+2507[2389][0-9]{7}$/;
export const RWANDA_PHONE_MESSAGE =
  'Phone number must be a valid Rwanda number (+2507XXXXXXXX).';

export const RWANDA_NATIONAL_ID_REGEX = /^\d{16}$/;
export const RWANDA_NATIONAL_ID_MESSAGE =
  'National ID must be exactly 16 digits.';

export const REG_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com|yahoo\.com|reg\.rw)$/;
export const REG_EMAIL_MESSAGE =
  'Email must be a valid @gmail.com, @yahoo.com or @reg.rw address.';
