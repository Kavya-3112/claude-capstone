/** Single place for storage key names (architecture sections 4, 12). */
export const STORAGE_KEY = 'contacts.v1';
export const BACKUP_KEY = 'contacts.v1.backup';

/** Limits counted in Unicode code points (impl-plan decision 1; FR-48). */
export const NAME_MAX_LENGTH = 100;
export const PHONE_MAX_LENGTH = 20;
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;
