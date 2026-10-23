import { describe, it, expect } from 'vitest';
import { MSG, blockedReasonText } from '../../src/ui/messages';

/**
 * CR-12: the UI must disable Add/Edit/Delete and show one of these three
 * drafted strings, selected by `Store.mutationBlock()`'s reason. This locks
 * the mapping so a future rename of a MSG string or a reordered switch is
 * caught here instead of only in e2e.
 */
describe('blockedReasonText (CR-12)', () => {
  it('maps "recovery" to the recovery-specific drafted string', () => {
    expect(blockedReasonText('recovery')).toBe(MSG.blockedRecovery);
  });
  it('maps "leftover-backup" to the leftover-backup-specific drafted string', () => {
    expect(blockedReasonText('leftover-backup')).toBe(MSG.blockedLeftover);
  });
  it('maps "stale" to the stale-specific drafted string', () => {
    expect(blockedReasonText('stale')).toBe(MSG.blockedStale);
  });
  it('the three reasons map to three distinct, non-empty strings', () => {
    const texts = new Set(
      (['recovery', 'leftover-backup', 'stale'] as const).map(blockedReasonText),
    );
    expect(texts.size).toBe(3);
    for (const t of texts) expect(t.length).toBeGreaterThan(0);
  });
});
