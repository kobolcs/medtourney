const MAX_SPAN_DAYS = 10;
const DAY_MS = 86400000;
function weekday(date) {
    return date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}
export function formatDurationLabel(date, dateTo) {
    if (isNaN(date.getTime()))
        return '';
    const to = dateTo ? new Date(dateTo) : null;
    if (!to || isNaN(to.getTime()) || to.getTime() < date.getTime()) {
        return weekday(date);
    }
    const days = Math.round((to.getTime() - date.getTime()) / DAY_MS) + 1;
    if (days === 1)
        return `${weekday(date)} · 1 day`;
    if (days > MAX_SPAN_DAYS)
        return `${days} days`;
    return `${weekday(date)}–${weekday(to)} · ${days} days`;
}
//# sourceMappingURL=durationLabel.js.map