/**
 * ExportService - Handles export operations
 *
 * Provides:
 * - CSV export functionality
 * - Calendar (.ics) file generation
 * - File download handling
 */

import { Tournament } from '../types';

export class ExportService {
    /**
     * Export tournaments to CSV format
     */
    exportToCSV(tournaments: Tournament[]): void {
        if (tournaments.length === 0) {
            throw new Error('No tournaments to export');
        }

        // CSV header
        const headers = ['Name', 'Location', 'Date', 'Category', 'URL'];
        const csvRows = [headers.join(',')];

        // CSV data rows
        tournaments.forEach(tournament => {
            const row = [
                this.escapeCSV(tournament.name),
                this.escapeCSV(tournament.location),
                tournament.date.toISOString().split('T')[0],
                this.escapeCSV(tournament.category),
                tournament.url
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

        const filename = `chess-tournaments-${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadFile(blob, filename);

        console.log(`Exported ${tournaments.length} tournaments to CSV`);
    }

    /**
     * Export single tournament to calendar (.ics) format
     */
    exportToCalendar(tournament: Tournament): void {
        const icsContent = this.generateICSContent(tournament);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

        const safeName = tournament.name
            .replace(/[^a-z0-9]/gi, '-')
            .replace(/-+/g, '-')
            .toLowerCase();
        const filename = `${safeName}.ics`;

        this.downloadFile(blob, filename);

        console.log(`Exported tournament to calendar: ${tournament.name}`);
    }

    /**
     * Generate ICS (iCalendar) content for a tournament
     * RFC 5545 compliant
     */
    private generateICSContent(tournament: Tournament): string {
        const now = new Date();
        const dateStr = this.formatICSDate(tournament.date);
        const endDateStr = this.formatICSDate(this.addDays(tournament.date, 1));
        const timestamp = this.formatICSDate(now);

        // Generate unique ID
        const uid = `tournament-${tournament.date.getTime()}-${Math.random().toString(36).substr(2, 9)}@medtourney.com`;

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MedTourney//Chess Tournament Finder//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${timestamp}`,
            `DTSTART;VALUE=DATE:${dateStr}`,
            `DTEND;VALUE=DATE:${endDateStr}`,
            `SUMMARY:${this.escapeICS(tournament.name)}`,
            `LOCATION:${this.escapeICS(tournament.location)}`,
            `DESCRIPTION:${this.escapeICS(`${tournament.category} - ${tournament.description}\\n\\nMore info: ${tournament.url}`)}`,
            `URL:${tournament.url}`,
            `CATEGORIES:Chess,Tournament`,
            'STATUS:CONFIRMED',
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
            'END:VCALENDAR'
        ];

        return lines.join('\r\n');
    }

    /**
     * Format date for ICS file (YYYYMMDD)
     */
    private formatICSDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    }

    /**
     * Add days to a date
     */
    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Escape special characters for CSV
     */
    private escapeCSV(text: string): string {
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    /**
     * Escape special characters for ICS
     */
    private escapeICS(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    /**
     * Trigger file download in browser
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
