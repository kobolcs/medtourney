/**
 * The footer's "Feedback" link. The address never appears in the page or the
 * bundle as one string: it is stored below as reversed pieces and only put
 * together into a mailto: link when someone clicks, which keeps it away from
 * address-harvesting bots that scan HTML/JS for "name@domain".
 *
 * To set it, write the address's pieces reversed: for feedback@example.com
 *     CONTACT_PARTS = ['kcabdeef', 'moc.elpmaxe'];
 * Empty = the Feedback link stays hidden.
 */
export const CONTACT_PARTS: readonly string[] = ['yenruotdem', 'moc.liamnotorp'];

const reverse = (text: string): string => [...text].reverse().join('');

/** The contact address, or null when none is set. */
export function contactAddress(parts: readonly string[] = CONTACT_PARTS): string | null {
    if (parts.length !== 2 || parts.some(part => !part)) return null;
    return `${reverse(parts[0]!)}${String.fromCharCode(64)}${reverse(parts[1]!)}`;
}

/** mailto: link with a subject, so feedback is easy to spot in the inbox. */
export function feedbackMailto(address: string): string {
    return `mailto:${address}?subject=${encodeURIComponent('MedTourney feedback')}`;
}

/** Show the footer link if an address is set; build the mailto: only on click. */
export function initFeedbackLink(parts: readonly string[] = CONTACT_PARTS, root: Document = document): void {
    const wrap = root.getElementById('feedbackWrap');
    const link = root.getElementById('feedbackLink');
    const address = contactAddress(parts);
    if (!wrap || !link || !address) return;
    wrap.hidden = false;
    link.addEventListener('click', () => {
        link.setAttribute('href', feedbackMailto(address));
    });
}
