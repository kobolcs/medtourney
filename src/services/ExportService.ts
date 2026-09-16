/**
 * ExportService - Handles export operations
 *
 * Provides:
 * - CSV export functionality
 * - Calendar (.ics) file generation (RFC 5545 compliant)
 * - File download handling
 *
 * Design note:
 * The string-building methods (`buildCSV`, `buildICSForTournament`,
 * `buildICSForTournaments`) are pure and side-effect free so they can be
 * unit-tested directly. The `exportTo*` methods are thin wrappers that build
 * the content and then trigger a browser download.
 */

import { Tournament } from '../types';

export class ExportService {
    private readonly UID_DOMAIN = 'medtourney.github.io';

    // ---------------------------------------------------------------------
    // CSV
    // ---------------------------------------------------------------------

    /**
     * Build CSV content for the given tournaments (pure, testable).
     */
    buildCSV(tournaments: Tournament[]): string {
        if (tournaments.length === 0) {
            throw new Error('No tournaments to export');
        }

        const headers = ['Name', 'Location', 'Date', 'Category', 'URL'];
        const csvRows = [headers.join(',')];

        tournaments.forEach(tournament => {
            const row = [
                this.escapeCSV(tournament.name),
                this.escapeCSV(tournament.location),
                this.formatICSDateOnlyHyphen(tournament.date),
                this.escapeCSV(tournament.category),
                this.escapeCSV(tournament.url),
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Export tournaments to a downloaded CSV file.
     */
    exportToCSV(tournaments: Tournament[]): void {
        const csvContent = this.buildCSV(tournaments);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `chess-tournaments-${this.formatICSDateOnlyHyphen(new Date())}.csv`;
        this.downloadFile(blob, filename);
    }

    // ---------------------------------------------------------------------
    // iCalendar (single + multiple)
    // ---------------------------------------------------------------------

    /**
     * Build a complete VCALENDAR with a single VEVENT (pure, testable).
     */
    buildICSForTournament(tournament: Tournament): string {
        const lines = [
            ...this.calendarHeaderLines(),
            ...this.eventLines(tournament, new Date()),
            'END:VCALENDAR',
        ];
        return this.serializeICS(lines);
    }

    /**
     * Build a single VCALENDAR containing one VEVENT per tournament
     * (pure, testable).
     */
    buildICSForTournaments(tournaments: Tournament[]): string {
        if (tournaments.length === 0) {
            throw new Error('No tournaments to export');
        }

        const now = new Date();
        const lines = [...this.calendarHeaderLines()];

        for (const tournament of tournaments) {
            lines.push(...this.eventLines(tournament, now));
        }

        lines.push('END:VCALENDAR');
        return this.serializeICS(lines);
    }

    /**
     * Export a single tournament to a downloaded .ics file.
     */
    exportToCalendar(tournament: Tournament): void {
        const icsContent = this.buildICSForTournament(tournament);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

        const safeName = tournament.name
            .replace(/[^a-z0-9]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
        const filename = `${safeName || 'tournament'}.ics`;

        this.downloadFile(blob, filename);
    }

    /**
     * Export multiple shortlisted tournaments into a single downloaded .ics file.
     */
    exportMultipleToCalendar(tournaments: Tournament[]): void {
        const icsContent = this.buildICSForTournaments(tournaments);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const filename = `chess-shortlist-${this.formatICSDateOnlyHyphen(new Date())}.ics`;
        this.downloadFile(blob, filename);
    }

    // ---------------------------------------------------------------------
    // Building blocks
    // ---------------------------------------------------------------------

    private calendarHeaderLines(): string[] {
        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MedTourney//Chess Tournament Finder//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
        ];
    }

    /**
     * Build the VEVENT lines for a tournament as an all-day event.
     * DTSTART/DTEND use VALUE=DATE (DTEND is exclusive = last day + 1).
     * Uses dateTo when available so multi-day events span their full duration.
     */
    private eventLines(tournament: Tournament, now: Date): string[] {
        const startDate = this.formatICSDateOnly(tournament.date);
        const lastDay = tournament.dateTo ? new Date(tournament.dateTo) : tournament.date;
        const endDate = this.formatICSDateOnly(this.addDaysUTC(lastDay, 1));
        const dtstamp = this.formatICSDateTimeUTC(now);
        const uid = this.generateStableUID(tournament);

        const description = `${tournament.category} - ${tournament.description}\n\nMore info: ${tournament.url}`;

        return [
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${endDate}`,
            `SUMMARY:${this.escapeICS(tournament.name)}`,
            `LOCATION:${this.escapeICS(tournament.location)}`,
            `DESCRIPTION:${this.escapeICS(description)}`,
            `URL:${tournament.url}`,
            'CATEGORIES:Chess,Tournament',
            'STATUS:CONFIRMED',
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
        ];
    }

    /**
     * Apply RFC 5545 line folding and join with CRLF.
     */
    private serializeICS(lines: string[]): string {
        return lines.map(line => this.foldLine(line)).join('\r\n');
    }

    // ---------------------------------------------------------------------
    // Deterministic UID
    // ---------------------------------------------------------------------

    /**
     * Generate a stable, deterministic UID for a tournament.
     *
     * The same tournament always produces the same UID; different tournaments
     * produce different UIDs. No randomness is used so re-exporting an event
     * updates the existing entry in the user's calendar instead of duplicating.
     *
     * Stable key is derived from (in priority order): tournament URL, date,
     * normalized name, and normalized location.
     */
    generateStableUID(tournament: Tournament): string {
        const key = [
            (tournament.url || '').trim().toLowerCase(),
            this.formatICSDateOnly(tournament.date),
            (tournament.name || '').trim().toLowerCase().replace(/\s+/g, ' '),
            (tournament.location || '').trim().toLowerCase().replace(/\s+/g, ' '),
        ].join('|');

        return `medtourney-${this.hashString(key)}@${this.UID_DOMAIN}`;
    }

    /**
     * Deterministic non-negative string hash (djb2 variant), base-36 encoded.
     */
    private hashString(input: string): string {
        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
            // hash * 33 + charCode, kept in 32-bit range
            hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
        }
        // Convert to unsigned and base-36 for a compact, stable string
        return (hash >>> 0).toString(36);
    }

    // ---------------------------------------------------------------------
    // Date formatting helpers
    // ---------------------------------------------------------------------

    /**
     * Format a date as an iCalendar VALUE=DATE value: YYYYMMDD (UTC).
     *
     * Tournament dates originate from ISO `YYYY-MM-DD` strings parsed as UTC
     * midnight, so UTC getters are used to avoid off-by-one-day shifts in
     * timezones west of UTC.
     */
    formatICSDateOnly(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Format a date as a UTC date-time: YYYYMMDDTHHMMSSZ.
     * Used for DTSTAMP.
     */
    formatICSDateTimeUTC(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    }

    /** Format a date as YYYY-MM-DD (UTC) for CSV / filenames. */
    private formatICSDateOnlyHyphen(date: Date): string {
        const s = this.formatICSDateOnly(date);
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }

    /** Add whole days to a date using UTC arithmetic (DST-safe). */
    private addDaysUTC(date: Date, days: number): Date {
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // ---------------------------------------------------------------------
    // Escaping & folding
    // ---------------------------------------------------------------------

    /**
     * Escape special characters for CSV (RFC 4180).
     */
    private escapeCSV(text: string): string {
        if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    /**
     * Escape special characters for an iCalendar TEXT value (RFC 5545 §3.3.11).
     * Order matters: backslash must be escaped first.
     */
    escapeICS(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r\n|\n|\r/g, '\\n');
    }

    /**
     * Fold a content line to <=75 octets per RFC 5545 §3.1.
     * Continuation lines are prefixed with a single space.
     *
     * Note: folding is performed on UTF-16 code units rather than octets; for
     * the short ASCII fields this app produces, the two are equivalent. Multi-
     * byte content is folded slightly conservatively, which remains valid.
     */
    private foldLine(line: string): string {
        const MAX = 75;
        if (line.length <= MAX) {
            return line;
        }

        const chunks: string[] = [];
        let index = 0;
        // First line: up to 75 chars.
        chunks.push(line.slice(index, index + MAX));
        index += MAX;
        // Continuation lines: leading space counts toward the 75, so 74 content chars.
        while (index < line.length) {
            chunks.push(' ' + line.slice(index, index + (MAX - 1)));
            index += MAX - 1;
        }
        return chunks.join('\r\n');
    }

    // ---------------------------------------------------------------------
    // Download
    // ---------------------------------------------------------------------

    /**
     * Trigger file download in browser.
     */
    private downloadFile(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}
