import { Tournament } from '../types';
import { escapeHTML } from './html';

/** Facts available in the source, kept short enough to compare in the results list. */
export function tournamentFormatHTML(tournament: Tournament): string {
    const details = tournament.details;
    if (!details) return '<p class="tournament-format">FIDE rating unconfirmed</p>';
    const parts: string[] = [];
    if (details.rounds) parts.push(`${details.rounds} rounds`);
    if (details.system) parts.push(details.system.replace(/-System$/i, '').replace(/^Swiss$/i, 'Swiss'));
    if (details.rated?.some(value => /international/i.test(value))) parts.push('FIDE-rated');
    else if (details.rated?.some(value => /national/i.test(value))) parts.push('National rating · FIDE rating unconfirmed');
    else parts.push('FIDE rating unconfirmed');
    return parts.length ? `<p class="tournament-format">${parts.map(escapeHTML).join(' · ')}</p>` : '';
}

