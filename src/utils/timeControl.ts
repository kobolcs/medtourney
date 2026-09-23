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
 * hover. Compact unit-less notations ("40/1,5 All/0,5", "15/5", "10-10")
 * go through SHORTHAND_RULES, each checked against the tournament's own
 * chess-results.com page or announcement PDF. Values that aren't a time
 * control return "" (hide the badge); anything we still can't read
 * confidently (a bare "10", "Fischer Kurz") is returned unchanged.
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

// Values that aren't a time control at all (checked against the tournament
// pages): a header typed as the value, a playing-hours range, a bare class.
const NOT_A_TIME_CONTROL_RE = /^(?:time control|standard|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})$/i;

/** "1,5" / "0,25" in slash notation are hours when small, minutes otherwise. */
function slashTimeToMinutes(value: string): number {
    const n = parseFloat(value.replace(',', '.'));
    return Math.round(n <= 5 ? n * 60 : n);
}

/**
 * Compact notations that don't carry units, each confirmed against the
 * tournament's chess-results.com page (its Rapid/Blitz/Standard label) or
 * announcement PDF. Tried in order; first match wins.
 */
const SHORTHAND_RULES: { re: RegExp; format: (m: RegExpMatchArray) => string }[] = [
    // "3/2" (Blitz), "15/5" (Rapid) - base/increment
    { re: /^(\d+)\s*\/\s*(\d+)$/, format: m => `${Number(m[1])}+${Number(m[2])}` },
    // "2x15" (Rapid) - 15 minutes per player
    { re: /^\d+\s*[x×]\s*(\d+)$/i, format: m => `${Number(m[1])}+0` },
    // Hungarian "10-10", "Rapid (15-15/all)" - X minutes per player
    // (plus any increment with a unit: "90-90 min/All + 30 sec/move" -> 90+30)
    {
        re: /(?:^|\()\s*(\d+)\s*-\s*\1\b/,
        format: (m): string => {
            const inc = m.input!.slice((m.index ?? 0) + m[0].length).match(INC_RE);
            return `${Number(m[1])}+${inc ? Number(inc[1]) : 0}`;
        },
    },
    // Turkish "15'' eklemesiz tempo" - "without increment"
    { re: /^(\d+)\s*(?:''|"|')\s*eklemesiz/i, format: m => `${Number(m[1])}+0` },
    // "Game/20 + 5 seconds per move"
    { re: /^game\s*\/\s*(\d+)(?:.*?(\d+)\s*s)?/i, format: m => `${Number(m[1])}+${m[2] ? Number(m[2]) : 0}` },
    // "all/0,25", "all / 130", "30 all + 30 sec/move" - one period, whole game
    { re: /^all\s*\/\s*(\d+(?:[.,]\d+)?)$/i, format: m => `${slashTimeToMinutes(m[1]!)}+0` },
    { re: /^(\d+)\s*all\s*\+\s*(\d+)\s*s/i, format: m => `${Number(m[1])}+${Number(m[2])}` },
    // "90 + 30 +30sec/Zug" - 90 min, then 30 min, 30 s per move throughout
    { re: /^(\d+)\s*\+\s*\d+\s*\+\s*(\d+)\s*s/i, format: m => `${Number(m[1])}+${Number(m[2])}…` },
    // Two-period slash notation (German/FIDE style). A bare "+N" counts as
    // the increment only straight after the time in "40/T+N" form; after
    // "T/40" it's the second period's minutes.
    //   "40/90+30, 30+30"                           -> 90+30…
    //   "40/1,5+ 30 sec/move  all/0,5 + 30 sec/mov" -> 90+30…
    //   "1:30/40 + 0:30"      -> 90+0…  (announcement PDF: no increment)
    //   "90/40 + 15 + 30 sec/incr."                 -> 90+30…
    //   "40/90  -/30", "90/1,5  -/0,5", "90/30/30 sec pro Move"
    {
        re: /^(?:40\s*\/\s*(\d+(?:[.,]\d+)?)(\s*\+\s*\d+(?![\d.,]*\s*(?:s|sec)))?|(\d+(?:[.,]\d+)?)\s*\/\s*(?:40\b|\d+(?:[.,]\d+)?))/i,
        format: (m): string => {
            const minutes = slashTimeToMinutes((m[1] ?? m[3])!);
            const rest = m.input!.slice(m[0].length);
            const adjacent = m[2] ? Number(m[2].replace(/\D/g, '')) : null;
            const unitInc = rest.match(INC_RE);
            const increment = adjacent ?? (unitInc ? Number(unitInc[1]) : 0);
            return `${minutes}+${increment}…`;
        },
    },
];

/** "1:30" / "0:30" (h:mm) -> minutes, so "1:30/40 + 0:30" reads as 90/40 + 30. */
function hoursMinutesToMinutes(s: string): string {
    return s.replace(/\b(\d):(\d{2})\b/g, (_, h: string, mm: string) => String(Number(h) * 60 + Number(mm)));
}

export function formatTimeControl(raw: string): string {
    const tc = raw.trim();
    if (!tc) return tc;
    if (NOT_A_TIME_CONTROL_RE.test(tc)) return '';
    const text = hoursMinutesToMinutes(normaliseQuotes(tc));

    const bare = text.match(BARE_RE);
    if (bare) return `${Number(bare[1])}+${Number(bare[2])}`;

    for (const rule of SHORTHAND_RULES) {
        const m = text.match(rule.re);
        if (m) return rule.format(m);
    }

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
