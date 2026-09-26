/**
 * "Add to Google Calendar" link for one tournament - opens Google Calendar's
 * event form in the browser, so nothing is downloaded and no desktop
 * calendar app (Outlook...) is needed. The .ics download (ExportService)
 * stays for Outlook / Apple Calendar / Thunderbird.
 */
import type { Tournament } from '../types';

/** YYYYMMDD of a local date */
function ymd(date: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * All-day event from the start date to the end date (dateTo, if later).
 * Google's end date is exclusive, so it is the day after the last day.
 */
export function googleCalendarUrl(tournament: Tournament): string {
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
