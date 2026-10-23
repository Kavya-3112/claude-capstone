/** Length in Unicode code points (impl-plan decision 1, FR-48). */
export function codePointLength(s: string): number {
  return Array.from(s).length;
}
