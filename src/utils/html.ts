/**
 * Escape text for safe insertion into HTML - both element content and
 * double-quoted attribute values.
 *
 * The textContent/innerHTML round-trip alone only escapes &, <, > (what's
 * needed between tags); it leaves " and ' untouched, which is unsafe once
 * the result is spliced into a double-quoted attribute like
 * `aria-label="${escapeHTML(text)}"` - a literal " in the source text would
 * close the attribute early and let the rest inject a new one.
 */
export function escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
