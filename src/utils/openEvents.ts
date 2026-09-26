/**
 * The "Open to all" filter: which events are clearly NOT open to everyone.
 *
 * chess-results.com's category column is almost always just the time
 * control ("Classical", "Rapid"...), so requiring the word "Open" hid ~80%
 * of events - including every Black Sea / Caspian one - although most are
 * ordinary open Swiss tournaments. The filter now hides only events whose
 * name or category says they are restricted. Youth / school and team /
 * league events have their own filters and are not decided here.
 */

/** Explicitly open ("Open", "Offene", "Abierto", "Aperto", "Otwarty"...) - always open */
const OPEN = /\b(open|offene?n?|abierto|aberto|aperto|otwarty|ouvert|nyílt|otvoreni?)\b/i;

/**
 * Clearly restricted: invitational / closed events, round robins and norm
 * events (typically invited players), club-internal championships.
 */
const RESTRICTED = new RegExp([
    'invitational', 'invitation', 'invitacional', 'zaproszeniow\\w*', 'einladungs\\w*',
    'closed', 'zamknięt\\w*', 'geschlossen\\w*',
    'round[- ]?robin', '\\brr\\b', 'rundenturnier',
    '\\b(gm|im|wgm|wim)[- ]?(norm|tournament|turnier)\\w*', 'norm (event|tournament)',
    'club championship', 'clubkampioenschap\\w*', 'vereinsmeisterschaft\\w*', 'klubmeisterschaft\\w*',
    'campionato sociale', 'torneo sociale', 'championnat du club', 'internal',
].join('|'), 'i');

/** True when the name/category says the event is not open to everyone. */
export function isRestrictedEvent(name: string, category: string): boolean {
    const text = `${name} ${category}`;
    if (OPEN.test(text)) return false;
    return RESTRICTED.test(text);
}
