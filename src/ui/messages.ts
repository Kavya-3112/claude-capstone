/**
 * All user-facing UI strings in one place, for review. Wording is plain, short
 * English chosen by the implementation agent (impl-plan decisions 13, 14, 17);
 * it is NOT approved wording. Validation messages come from the domain modules
 * (src/domain/name.ts and phone.ts).
 */
export const MSG = {
  nameLabel: 'Name',
  phoneLabel: 'Phone number',
  phoneHint: '7 to 15 digits. You can use a leading +, spaces, hyphens and parentheses.',
  addSubmit: 'Add contact',
  editSubmit: 'Save changes',
  cancel: 'Cancel',
  edit: 'Edit',
  del: 'Delete',
  editFormLabel: 'Edit contact',
  emptyState: 'No contacts yet. Add your first contact above.',

  contactAdded: 'Contact added.',
  contactUpdated: 'Contact updated.',
  contactDeleted: 'Contact deleted.',
  /** Never claims success (FR-45, FR-46). */
  notSaved: 'Not saved. The change is shown here but could not be stored.',
  blocked: 'Changes cannot be made right now.',
  notFound: 'That contact no longer exists.',
  finishEditFirst: 'Finish or cancel the edit that is open before editing another contact.',
  blockedRecovery: 'Add, edit and delete are turned off until you decide what to do with the saved data (see above).',
  blockedLeftover: 'Add, edit and delete are turned off until you restore or discard the backup (see above).',
  blockedStale: 'Add, edit and delete are turned off until you reload the contacts (see the message above).',

  // Search (T-18)
  searchLabel: 'Search contacts',
  searchHint: 'Search by name or part of a phone number.',
  searchClear: 'Clear search',
  searchCleared: 'Search cleared. All contacts are shown.',
  noMatch: 'No contacts match your search. Clear the search to see all contacts.',
  noMatchAnnounce: 'No contacts match your search.',
  hiddenBySearchSaved: 'Contact saved, but it is hidden by the current search.',
  hiddenBySearchUnsaved: 'Contact added, but it is hidden by the current search.',

  // Save-status banners (T-19)
  retry: 'Retry saving',
  retestStorage: 'Test storage again',
  unsavedBanner:
    'Not saved. Your changes, including any earlier unsaved ones, are shown here but are not stored. If you reload this page, they will be lost.',
  causeQuota: 'Browser storage is full.',
  causeSecurity: 'The browser blocked access to storage.',
  memoryOnlyBanner:
    'Contacts cannot be stored in this browser right now. What you add will be lost when you close or reload this page.',
  allSaved: 'All changes are saved.',
  stillNotSaved: 'Still not saved.',
  storageStillUnavailable: 'Storage is still not available.',

  // Multi-tab (T-21)
  staleBanner:
    'Another tab changed your contacts. Reload to see the latest data. This tab will not save changes until you reload.',
  staleUnsavedBanner:
    'Not saved. Another tab changed your contacts. Reload to see the latest data. Changes made here are not stored and will be lost when you reload.',
  reloadContacts: 'Reload contacts',
  reloadPromptTitle: 'Reload and lose your changes?',
  reloadPromptBody:
    'You have changes in this tab that are not saved. Reloading shows the newer contacts and discards them. Keep editing to leave them as they are (they still cannot be saved until you reload).',
  keepEditing: 'Keep editing',
  reloadDiscard: 'Reload and discard',
  contactsReloaded: 'Contacts reloaded.',

  // Recovery of unreadable data (T-20)
  recoveryHeading: 'Your saved contacts could not be read',
  recoveryUnchanged:
    'Nothing has been changed or deleted. Add, edit and delete are turned off until you choose what to do. You can still search.',
  recoveryNoneReadable: 'The saved data could not be read, so no contacts are shown.',
  copyOriginal: 'Copy original data',
  downloadOriginal: 'Download original data',
  replaceSaved: 'Replace saved data',
  leaveUnchanged: 'Leave data unchanged',
  replaceCancel: 'Cancel',
  replaceConfirmButton: 'Replace',
  replaceConfirmNote:
    'A temporary backup of the original is kept until you confirm the result. Copy or download the original first if you may need it.',
  recoveryLeft:
    'Your saved data was left unchanged. Changes stay turned off. You can still search, copy or download the original, or replace it.',
  backupFailed:
    'The temporary backup could not be saved, so nothing was changed. You can replace without a backup only if you have already copied or downloaded the original data.',
  ownCopyCheck: 'I have copied or downloaded the original data myself.',
  replaceWithoutBackup: 'Replace without backup',
  replaceWriteFailed: 'The new data could not be saved, so your original data is unchanged.',
  tryAgain: 'Try again',
  replaceStale:
    'The saved data changed since this page loaded, so nothing was replaced. Reload to see the latest data.',
  reloadData: 'Reload page data',
  replacedHeading: 'Saved data replaced',
  replacedNote:
    'The original is still kept as a temporary backup. If this looks right, confirm to remove the backup. If it does not, do not confirm: reload the page and you will be offered the original back.',
  confirmResult: 'Confirm result and remove backup',
  retryRemoveBackup: 'Try removing backup again',
  backupRemoveFailed: 'The backup could not be removed. You can try again.',
  resultConfirmed: 'Result confirmed. Backup removed.',
  replacedAnnounce: 'Saved data replaced.',
  replacedNoBackup: 'Saved data replaced without a backup.',
  copied: 'Original data copied.',
  copyFailed: 'Copy failed. Use Download instead.',
  downloaded: 'Download started.',

  // Leftover backup (T-20)
  leftoverHeading: 'A backup was found',
  leftoverBody:
    'An earlier replacement left a temporary backup of your original data. Choose what to do with it. Changes are turned off until you decide.',
  restoreBackup: 'Restore backup',
  discardBackup: 'Discard backup',
  copyBackup: 'Copy backup data',
  downloadBackup: 'Download backup data',
  restoreChanged:
    'The saved contacts changed since this page loaded. Restoring will replace them with the backup. Restore anyway?',
  restoreAnyway: 'Restore anyway',
  keepCurrent: 'Keep current data',
  discardAsk: 'Discard the backup permanently? This cannot be undone.',
  discardYes: 'Yes, discard it',
  keepBackup: 'Keep the backup',
  backupRestored: 'Backup restored.',
  backupRestoredNotRemoved: 'Backup restored, but the backup could not be removed. You can discard it.',
  backupDiscarded: 'Backup discarded.',
  restoreFailed: 'Could not restore the backup.',
  discardFailed: 'Could not discard the backup.',

  dialogTitle: 'Delete this contact?',
  dialogConfirm: 'Delete contact',
} as const;

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

export const resultsCount = (n: number) => (n === 1 ? '1 contact found.' : `${n} contacts found.`);
/** Summary line of the unreadable-data notice (FR-52: invalid records are reported by count). */
export const invalidSummary = (invalid: number, shown: number) =>
  invalid === 0 && shown === 0
    ? MSG.recoveryNoneReadable
    : `${plural(invalid, 'saved record is', 'saved records are')} invalid and not shown. ${plural(shown, 'readable contact is', 'readable contacts are')} shown below as a read-only preview.`;
export const replaceAsk = (shown: number) =>
  `Replace the saved data with ${plural(shown, 'readable contact', 'readable contacts')}? ${MSG.replaceConfirmNote}`;
export const replacedBody = (shown: number) =>
  `The saved data now holds ${plural(shown, 'contact', 'contacts')}. ${MSG.replacedNote}`;
export const editAria = (name: string) => `Edit ${name}`;
export const deleteAria = (name: string) => `Delete ${name}`;
export const dialogBody = (name: string, phone: string) =>
  `This will permanently delete ${name} (${phone}). This cannot be undone.`;
export const fixErrors = (messages: string[]) => `Please fix the problems: ${messages.join(' ')}`;

/**
 * Visible reason shown near Add/Edit/Delete controls while they are disabled
 * (impl-plan decision 18 item 4; CR-12). Mirrors `Store.mutationBlock()`'s
 * three reasons one-to-one; search is deliberately not covered here (decision 7).
 */
export function blockedReasonText(block: 'recovery' | 'leftover-backup' | 'stale'): string {
  switch (block) {
    case 'recovery':
      return MSG.blockedRecovery;
    case 'leftover-backup':
      return MSG.blockedLeftover;
    case 'stale':
      return MSG.blockedStale;
  }
}
