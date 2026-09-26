/**
 * UIManager, part: CardPart
 *
 * One link in UIManager's class chain (src/services/UIManager.ts): UIState ->
 * CardPart -> PaginationPart -> StatusViewsPart -> UIManager.
 * Methods moved unchanged out of UIManager.ts.
 */
import { Tournament } from '../../types';
import { formatLocation } from '../../utils/countries';
import { formatTimeControl } from '../../utils/timeControl';
import { formatDurationLabel } from '../../utils/durationLabel';
import { escapeHTML } from '../../utils/html';
import { UIState } from './UIState';

/** Tournament cards and the featured banner: date badge, location, pills, actions. */
export abstract class CardPart extends UIState {
    /**
     * Create tournament card element
     */
    protected formatDateRange(dateFrom: Date, dateTo?: string): string {
        const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        if (!dateTo) return dateFrom.toLocaleDateString('en-GB', opts);

        const to = new Date(dateTo);
        if (isNaN(to.getTime()) || to.getTime() <= dateFrom.getTime()) {
            return dateFrom.toLocaleDateString('en-GB', opts);
        }

        const sameYear = dateFrom.getFullYear() === to.getFullYear();
        const sameMonth = sameYear && dateFrom.getMonth() === to.getMonth();

        if (sameMonth) {
            const fromDay = dateFrom.toLocaleDateString('en-GB', { day: 'numeric' });
            const toFull = to.toLocaleDateString('en-GB', opts);
            return `${fromDay}–${toFull}`;
        }
        if (sameYear) {
            const fromShort = dateFrom.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const toFull = to.toLocaleDateString('en-GB', opts);
            return `${fromShort}–${toFull}`;
        }
        return `${dateFrom.toLocaleDateString('en-GB', opts)}–${to.toLocaleDateString('en-GB', opts)}`;
    }

    /**
     * The card's left-hand date badge: day, 3-letter month, an end line for
     * multi-day events ("→ 27", or "→ 6 Nov" across months) and the year
     * when it isn't this year (list sorts other than date have no month
     * headers to show it). It is the card's only visible date.
     */
    protected formatDateBadge(date: Date, dateTo?: string): { day: string; month: string; end: string; year: string } {
        const month3 = (d: Date): string =>
            // en-GB renders September as "Sept" (4 chars) - slice to a consistent 3.
            d.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3);
        const day = date.toLocaleDateString('en-GB', { day: 'numeric' });
        const month = month3(date);

        let end = '';
        const to = dateTo ? new Date(dateTo) : null;
        if (to && !isNaN(to.getTime()) && to.getTime() > date.getTime()) {
            const toDay = to.toLocaleDateString('en-GB', { day: 'numeric' });
            const sameMonth = to.getMonth() === date.getMonth() && to.getFullYear() === date.getFullYear();
            end = sameMonth ? `→ ${toDay}` : `→ ${toDay} ${month3(to)}`;
        }
        const year = date.getFullYear() !== new Date().getFullYear() ? String(date.getFullYear()) : '';
        return { day, month, end, year };
    }

    /**
     * Colored pill for the tournament's time-control class (Classical/Rapid/
     * Blitz), derived from FilterService.annotate()'s classificationReasons
     * rather than re-parsing the category string, so it agrees with the
     * checkboxes that actually filtered this tournament in. Priority favors
     * the more specific/faster format when a multi-format event's category
     * mentions more than one (e.g. "Standard & Blitz").
     */
    protected timeControlClassHTML(tournament: Tournament): string {
        const reasons = tournament.classificationReasons ?? [];
        const cls = reasons.includes('Blitz') ? 'blitz'
            : reasons.includes('Rapid') ? 'rapid'
            : reasons.includes('Classical') ? 'classical'
            : null;
        if (!cls) return '';
        const label = cls.charAt(0).toUpperCase() + cls.slice(1);
        return `<span class="time-control-class time-control-class--${cls}">${label}</span>`;
    }

    /**
     * Remaining category tokens (Open, Youth, U18…) as separate chips, once
     * the time-control words have their own colored pill above — avoids
     * repeating "Blitz" in both a colored pill and a plain string.
     */
    protected categoryTagsHTML(tournament: Tournament): string {
        const TIME_WORDS = /^(classical|standard|rapid|blitz)$/i;
        const tokens = tournament.category
            .split(',')
            .map(t => t.trim())
            .filter(t => t && !TIME_WORDS.test(t));
        return tokens.map(t => `<span class="category-tag">${escapeHTML(t)}</span>`).join('');
    }

    /**
     * Travel context on the location line: nearest airport with airline
     * flights, as city + IATA code ("Alicante ALC"; the code alone before the
     * nightly data run adds the city), with the full name in the tooltip /
     * for screen readers. Distance is straight-line, and says so.
     */
    protected airportHintHTML(tournament: Tournament): string {
        const a = tournament.airport;
        if (!a) {
            // Placed on the map but no airport with flights within 150 km -
            // say so, rather than leave people wondering whether it was checked
            if (typeof tournament.lat !== 'number') return '';
            const none = 'No airport with airline flights within 150 km in a straight line';
            return `<span class="airport-hint airport-hint--none" title="${none}"><span aria-hidden="true">✈ none within 150 km</span><span class="sr-only">${none}</span></span>`;
        }
        const full = `Nearest airport with airline flights: ${a.name} (${a.iata}), about ${a.km} km in a straight line`;
        // City before the code ("Jerez XRY"): a bare X../Q../Z.. code reads like a rail station
        const label = a.city ? `${a.city} ${a.iata}` : a.iata;
        return `<span class="airport-hint" title="${escapeHTML(full)}"><span aria-hidden="true">✈ ${escapeHTML(label)} · ${a.km} km</span><span class="sr-only">${escapeHTML(full)}</span></span>`;
    }

    /**
     * Render (or hide) the featured "Tournament of the Week" card.
     */
    renderFeaturedTournament(tournament: Tournament | null): void {
        const container = document.getElementById('featuredTournament');
        if (!container) return;

        if (!tournament) {
            container.style.display = 'none';
            return;
        }

        const dateStr = this.formatDateRange(tournament.date, tournament.dateTo);

        container.style.display = 'block';
        // A slim one-line banner (it used to be the tallest thing on the page
        // and pushed the first result off a phone screen): the name is the
        // link, plus where and when, and a compact calendar button.
        const beach = tournament.seaM !== undefined;
        container.innerHTML = `
            <div class="featured-card" role="region" aria-label="Tournament of the Week">
                <span class="featured-label">${beach ? '<span aria-hidden="true">🏖</span> ' : ''}Tournament of the Week</span>
                <h3 class="featured-name">
                    <a href="${escapeHTML(tournament.url)}" target="_blank" rel="noopener noreferrer"
                       class="featured-name-link">${escapeHTML(tournament.name)}</a>
                </h3>
                <span class="featured-where">${formatLocation(tournament.location, tournament.town)} · <span class="featured-date">${dateStr}</span></span>
                <button type="button" class="calendar-export-btn featured-calendar-btn" aria-haspopup="menu" aria-expanded="false"
                        data-tournament-url="${escapeHTML(tournament.url)}"
                        aria-label="Add ${escapeHTML(tournament.name)} to calendar"
                        title="Add to calendar"><span aria-hidden="true">📅</span></button>
            </div>
        `;
    }

    protected createTournamentCard(tournament: Tournament): HTMLElement {
        const card = document.createElement('article');
        card.className = 'tournament-card';
        card.setAttribute('aria-label', tournament.name);
        card.dataset.tournamentUrl = tournament.url;

        const { day, month, end, year } = this.formatDateBadge(tournament.date, tournament.dateTo);
        const dateStr = this.formatDateRange(tournament.date, tournament.dateTo);

        const isShortlisted = this.shortlistedUrls.has(tournament.url);
        const tags = tournament.travelTags ?? [];

        const GEOGRAPHIC_TAGS = new Set(['Mediterranean', 'Atlantic', 'Black Sea', 'Caspian', 'Seaside', 'Senior-friendly', "Women's"]);
        const meaningfulTags = tags.filter(t => GEOGRAPHIC_TAGS.has(t));
        const travelTagsHTML = meaningfulTags.length > 0
            ? `<div class="travel-tags">${meaningfulTags.map(t => `<span class="travel-tag">${escapeHTML(t)}</span>`).join('')}</div>`
            : '';

        // Card accent color encodes category — Mediterranean/seaside takes
        // priority over senior when a tournament carries both tags.
        if (tags.includes('Mediterranean') || tags.includes('Seaside')) {
            card.classList.add('tournament-card--mediterranean');
        } else if (tags.includes('Senior-friendly')) {
            card.classList.add('tournament-card--senior');
        }

        // Show raw time control only when it adds info beyond the class label
        const tc = (tournament.timeControl ?? '').trim();
        const TC_CLASS_LABELS = new Set(['classical', 'rapid', 'blitz', '']);
        const tcDisplay = TC_CLASS_LABELS.has(tc.toLowerCase()) ? '' : formatTimeControl(tc);
        const timeControlHTML = tcDisplay
            ? `<span class="time-control-badge" title="${escapeHTML(tc)}">${escapeHTML(tcDisplay)}</span>`
            : '';

        const timeControlClassHTML = this.timeControlClassHTML(tournament);
        const categoryTagsHTML = this.categoryTagsHTML(tournament);

        // Featured seaside: the venue itself is within 500 m of the sea
        const beachfrontHTML = tournament.seaM !== undefined
            ? `<span class="beachfront-pill" title="The venue is about ${tournament.seaM} m from the sea (OpenStreetMap coastline)"><span aria-hidden="true">🏖</span> Beachfront · ${tournament.seaM} m from the sea</span>`
            : '';
        if (tournament.seaM !== undefined) card.classList.add('tournament-card--beachfront');

        const durationLabel = formatDurationLabel(tournament.date, tournament.dateTo);
        const durationHTML = durationLabel
            ? `<span class="duration-pill">${escapeHTML(durationLabel)}</span>`
            : '';

        card.innerHTML = `
            <div class="tournament-date-badge" title="${escapeHTML(dateStr)}">
                <span class="sr-only">${escapeHTML(dateStr)}</span>
                <span class="tournament-date-badge-day" aria-hidden="true">${day}</span>
                <span class="tournament-date-badge-month" aria-hidden="true">${month}</span>
                ${end ? `<span class="tournament-date-badge-end" aria-hidden="true">${escapeHTML(end)}</span>` : ''}
                ${year ? `<span class="tournament-date-badge-year" aria-hidden="true">${year}</span>` : ''}
            </div>
            <div class="tournament-body">
                <div class="tournament-header">
                    <h3 class="tournament-name">
                        <a href="${escapeHTML(tournament.url)}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="tournament-link"
                           aria-label="View details for ${escapeHTML(tournament.name)}">
                            ${escapeHTML(tournament.name)}
                        </a>
                    </h3>
                    <div class="tournament-header-right">
                        <button class="shortlist-btn${isShortlisted ? ' shortlisted' : ''}"
                                data-tournament-url="${escapeHTML(tournament.url)}"
                                data-tournament-name="${escapeHTML(tournament.name)}"
                                aria-pressed="${isShortlisted}"
                                aria-label="${isShortlisted ? 'Remove from' : 'Add to'} shortlist: ${escapeHTML(tournament.name)}">
                            <span class="shortlist-star">${isShortlisted ? '★' : '☆'}</span>
                        </button>
                    </div>
                </div>
                <div class="tournament-location"><span class="tournament-place"${tournament.town ? ` title="${escapeHTML(tournament.location.replace(/,\s*[A-Z]{3}$/, ''))}"` : ''}>${formatLocation(tournament.location, tournament.town)}${this.airportHintHTML(tournament)}</span></div>
                <div class="tournament-meta">
                    ${beachfrontHTML}
                    ${timeControlClassHTML}
                    ${timeControlHTML}
                    ${categoryTagsHTML}
                    ${durationHTML}
                </div>
                ${travelTagsHTML}
                <div class="tournament-actions">
                    <button class="calendar-export-btn" aria-haspopup="menu" aria-expanded="false"
                            data-tournament-url="${escapeHTML(tournament.url)}"
                            aria-label="Add ${escapeHTML(tournament.name)} to calendar">
                        <span aria-hidden="true">📅</span><span class="action-text"> Add to Calendar</span>
                    </button>
                    <button class="copy-link-btn"
                            data-tournament-url="${escapeHTML(tournament.url)}"
                            aria-label="Copy share link for ${escapeHTML(tournament.name)}">
                        <span aria-hidden="true">🔗</span><span class="action-text"> Copy link</span>
                    </button>
                </div>
            </div>
        `;

        return card;
    }
}
