function ymd(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
export function googleCalendarUrl(tournament) {
    const start = tournament.date;
    const last = tournament.dateTo ? new Date(tournament.dateTo) : start;
    const lastDay = isNaN(last.getTime()) || last < start ? start : last;
    const endExclusive = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
    const details = [tournament.category, tournament.description, `More info: ${tournament.url}`]
        .filter(Boolean)
        .join('\n\n');
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: tournament.name,
        dates: `${ymd(start)}/${ymd(endExclusive)}`,
        details,
        location: tournament.location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
//# sourceMappingURL=googleCalendar.js.map