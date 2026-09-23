/**
 * Normalise a scraped time-control string to chess notation "base+increment"
 * (minutes + seconds per move), e.g.:
 *
 *   10'05''                                   -> 10+5
 *   90´+ 30´´                                 -> 90+30
 *   Rapid: 10min +5sec increment per move     -> 10+5
 *   12 minut + 3 sekundy za tah               -> 12+3
 *   10 мин. + 5 сек. на ход                   -> 10+5
 *   20 Minuten                                -> 20+0
 *   90 min / 40 moves + 30 min + 30 s/move    -> 90+30…
 *
 * chess-results.com organisers type this field free-form in a dozen
 * languages, so parsing is deliberately loose: find the first number followed
 * by a minute/hour unit (base) and the first followed by a second unit
 * (increment). Multi-period controls (a move-40 time control plus a second
 * period) get a trailing "…" - the card shows the full original text on
 * hover. Anything we can't read confidently (e.g. "40/90+30, 30+30",
 * "1:30/40 + 0:30", a bare "10") is returned unchanged.
 */

// Bare notation, optionally with a "2x" (per player) prefix and a seconds
// marker on the increment: 10+5, 90 + 30, 3+2sec, 2x15+5, 15 plus 5,
// 12 + 5 s/tah
const BARE_RE = /^(?:\d+\s*[x×]\s*)?(\d+)\s*(?:\+|plus)\s*(\d+)\s*(?:''|"|'|s|sec)?(?:\s*\/\s*\S+)?$/i;

// Base time: number + minute/hour unit. ' is minutes in quote notation
// (10'+5''), so it must not be the first half of ''.
const BASE_RE = new RegExp(
    '(\\d+(?:[.,]\\d+)?)[\\s.]*(' + [
        "'(?!')",
        'min', 'm(?![a-z])', 'perc', 'dəq', 'мин', 'хв', 'λεπτ',
        'h(?![a-z])', 'hours?', 'hod', 'std', 'stunde',
    ].join('|') + ')',
    'i'
);
const HOUR_UNITS = /^(h|hour|hod|std|stunde)/i;

// Increment: number + second unit ('' / " in quote notation)
const INC_RE = new RegExp(
    '(\\d+)[\\s.]*(?:' + [
        "''", '"',
        'sec', 'seg', 'sek', 's(?![a-z])', 'second', 'mp', 'san', 'сек', 'δευτ',
    ].join('|') + ')',
    'i'
);

// A second time period: "40 moves", "/40", "40 Züge", "to the end", "rest"
const MULTI_PERIOD_RE =
    /\/\s*40\b|\b40\s*\/|\b40\s*(?:moves|züge|z\b|tahů|tahu|poteza|mosse|coups)|за 40|mutarea 40|to the end|\/\s*end|\brest\b|für rest/i;

/** Map the many apostrophe/quote look-alikes organisers type onto ' and ". */
function normaliseQuotes(s: string): string {
    return s
        .replace(/[´`’‘΄՛′]/g, "'")
        .replace(/[″“”]/g, '"');
}

export function formatTimeControl(raw: string): string {
    const tc = raw.trim();
    if (!tc) return tc;
    const text = normaliseQuotes(tc);

    const bare = text.match(BARE_RE);
    if (bare) return `${Number(bare[1])}+${Number(bare[2])}`;

    const base = text.match(BASE_RE);
    if (!base) return tc;

    const value = parseFloat(base[1]!.replace(',', '.'));
    const minutes = Math.round(HOUR_UNITS.test(base[2]!) ? value * 60 : value);

    // Only look for the increment after the base, so "2x 1,5 h" style
    // prefixes or a leading "40/" can't be misread as seconds.
    const afterBase = text.slice((base.index ?? 0) + base[0].length);
    const inc = afterBase.match(INC_RE);
    // "90'+30" - a bare number straight after the base is the increment.
    const bareInc = inc ? null : afterBase.match(/^\s*\+\s*(\d+)\s*$/);
    const increment = inc ? Number(inc[1]) : bareInc ? Number(bareInc[1]) : 0;

    const suffix = MULTI_PERIOD_RE.test(text) ? '…' : '';
    return `${minutes}+${increment}${suffix}`;
}
