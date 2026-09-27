export const CONTACT_PARTS = ['yenruotdem', 'moc.liamnotorp'];
const reverse = (text) => [...text].reverse().join('');
export function contactAddress(parts = CONTACT_PARTS) {
    if (parts.length !== 2 || parts.some(part => !part))
        return null;
    return `${reverse(parts[0])}${String.fromCharCode(64)}${reverse(parts[1])}`;
}
export function feedbackMailto(address) {
    return `mailto:${address}?subject=${encodeURIComponent('MedTourney feedback')}`;
}
export function initFeedbackLink(parts = CONTACT_PARTS, root = document) {
    const wrap = root.getElementById('feedbackWrap');
    const link = root.getElementById('feedbackLink');
    const address = contactAddress(parts);
    if (!wrap || !link || !address)
        return;
    wrap.hidden = false;
    link.addEventListener('click', () => {
        link.setAttribute('href', feedbackMailto(address));
    });
}
//# sourceMappingURL=contact.js.map