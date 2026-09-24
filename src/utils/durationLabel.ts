/**
 * Text for a tournament card's duration pill, with the weekday span a
 * traveller plans around:
 *
 *   Sat 26 Sep, no end date      -> "Sat"
 *   Sat 26 Sep - Sat 26 Sep      -> "Sat · 1 day"
 *   Fri 2 Oct - Sun 4 Oct        -> "Fri–Sun · 3 days"
 *   Fri 25 Sep - Fri 20 Nov      -> "57 days"
 *
 * Events longer than MAX_SPAN_DAYS are club/league championships played one
 * evening a week, so a "Fri–Fri" span would read as a daily event - those
 * show the day count alone. Weekdays use the same local-time Date the card's
 * date badge does, so the two always agree.
 */

const MAX_SPAN_DAYS = 10;
const DAY_MS = 86400000;

function weekday(date: Date): string {
    return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

export function formatDurationLabel(date: Date, dateTo?: string): string {
    if (isNaN(date.getTime())) return '';

    const to = dateTo ? new Date(dateTo) : null;
    if (!to || isNaN(to.getTime()) || to.getTime() < date.getTime()) {
        return weekday(date);
    }

    const days = Math.round((to.getTime() - date.getTime()) / DAY_MS) + 1;
    if (days === 1) return `${weekday(date)} · 1 day`;
    if (days > MAX_SPAN_DAYS) return `${days} days`;
    return `${weekday(date)}–${weekday(to)} · ${days} days`;
}
