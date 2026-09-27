const BARE_RE = /^(?:\d+\s*[x×]\s*)?(\d+)\s*(?:\+|plus)\s*(\d+)\s*(?:''|"|'|s|sec)?(?:\s*\/\s*\S+)?$/i;
const BASE_RE = new RegExp('(\\d+(?:[.,]\\d+)?)[\\s.]*(' + [
    "'(?!')",
    'min', 'm(?![a-z])', 'perc', 'dəq', 'мин', 'хв', 'λεπτ',
    'h(?![a-z])', 'hours?', 'hod', 'std', 'stunde',
].join('|') + ')', 'i');
const HOUR_UNITS = /^(h|hour|hod|std|stunde)/i;
const INC_RE = new RegExp('(\\d+)[\\s.]*(?:' + [
    "''", '"',
    'sec', 'seg', 'sek', 's(?![a-z])', 'second', 'mp', 'san', 'сек', 'δευτ',
].join('|') + ')', 'i');
const MULTI_PERIOD_RE = /\/\s*40\b|\b40\s*\/|\b40\s*(?:moves|züge|z\b|tahů|tahu|poteza|mosse|coups)|за 40|mutarea 40|to the end|\/\s*end|\brest\b|für rest/i;
function normaliseQuotes(s) {
    return s
        .replace(/[´`’‘΄՛′]/g, "'")
        .replace(/[″“”]/g, '"');
}
const NOT_A_TIME_CONTROL_RE = /^(?:time control|standard|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})$/i;
function slashTimeToMinutes(value) {
    const n = parseFloat(value.replace(',', '.'));
    return Math.round(n <= 5 ? n * 60 : n);
}
const SHORTHAND_RULES = [
    { re: /^(\d+)\s*\/\s*(\d+)$/, format: m => `${Number(m[1])}+${Number(m[2])}` },
    { re: /^\d+\s*[x×]\s*(\d+)$/i, format: m => `${Number(m[1])}+0` },
    {
        re: /(?:^|\()\s*(\d+)\s*-\s*\1\b/,
        format: (m) => {
            const inc = m.input.slice((m.index ?? 0) + m[0].length).match(INC_RE);
            return `${Number(m[1])}+${inc ? Number(inc[1]) : 0}`;
        },
    },
    { re: /^(\d+)\s*(?:''|"|')\s*eklemesiz/i, format: m => `${Number(m[1])}+0` },
    { re: /^game\s*\/\s*(\d+)(?:.*?(\d+)\s*s)?/i, format: m => `${Number(m[1])}+${m[2] ? Number(m[2]) : 0}` },
    { re: /^all\s*\/\s*(\d+(?:[.,]\d+)?)$/i, format: m => `${slashTimeToMinutes(m[1])}+0` },
    { re: /^(\d+)\s*all\s*\+\s*(\d+)\s*s/i, format: m => `${Number(m[1])}+${Number(m[2])}` },
    { re: /^(\d+)\s*\+\s*\d+\s*\+\s*(\d+)\s*s/i, format: m => `${Number(m[1])}+${Number(m[2])}…` },
    {
        re: /^(?:40\s*\/\s*(\d+(?:[.,]\d+)?)(\s*\+\s*\d+(?![\d.,]*\s*(?:s|sec)))?|(\d+(?:[.,]\d+)?)\s*\/\s*(?:40\b|\d+(?:[.,]\d+)?))/i,
        format: (m) => {
            const minutes = slashTimeToMinutes((m[1] ?? m[3]));
            const rest = m.input.slice(m[0].length);
            const adjacent = m[2] ? Number(m[2].replace(/\D/g, '')) : null;
            const unitInc = rest.match(INC_RE);
            const increment = adjacent ?? (unitInc ? Number(unitInc[1]) : 0);
            return `${minutes}+${increment}…`;
        },
    },
];
function hoursMinutesToMinutes(s) {
    return s.replace(/\b(\d):(\d{2})\b/g, (_, h, mm) => String(Number(h) * 60 + Number(mm)));
}
export function formatTimeControl(raw) {
    const tc = raw.trim();
    if (!tc)
        return tc;
    if (NOT_A_TIME_CONTROL_RE.test(tc))
        return '';
    const text = hoursMinutesToMinutes(normaliseQuotes(tc));
    const bare = text.match(BARE_RE);
    if (bare)
        return `${Number(bare[1])}+${Number(bare[2])}`;
    for (const rule of SHORTHAND_RULES) {
        const m = text.match(rule.re);
        if (m)
            return rule.format(m);
    }
    const base = text.match(BASE_RE);
    if (!base)
        return tc;
    const value = parseFloat(base[1].replace(',', '.'));
    const minutes = Math.round(HOUR_UNITS.test(base[2]) ? value * 60 : value);
    const afterBase = text.slice((base.index ?? 0) + base[0].length);
    const inc = afterBase.match(INC_RE);
    const bareInc = inc ? null : afterBase.match(/^\s*\+\s*(\d+)\s*$/);
    const increment = inc ? Number(inc[1]) : bareInc ? Number(bareInc[1]) : 0;
    const suffix = MULTI_PERIOD_RE.test(text) ? '…' : '';
    return `${minutes}+${increment}${suffix}`;
}
//# sourceMappingURL=timeControl.js.map