/**
 * Tournament detail panel: a click on a card opens everything we know about
 * the tournament on MedTourney itself (dates, venue with map links, time
 * control, sea, nearest airport), with chess-results.com as one clear link
 * at the bottom for registration, players and results - so finding a
 * tournament doesn't mean leaving the site (first user reviews).
 *
 * A native <dialog> (focus trap, Escape, top layer). Safari before 15.4 has
 * no showModal() - the panel then opens as a plain fixed overlay. Opening
 * pushes a history entry so the phone's back button closes the panel
 * instead of leaving the site.
 */
import type { Tournament } from '../types';
import { escapeHTML } from './html';
import { formatLocation } from './countries';
import { formatTimeControl } from './timeControl';
import { SEA_LABELS } from './seas';

const PANEL_ID = 'tournamentDetail';
const HISTORY_KEY = 'medtourneyDetail';

const dayFormat: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };

/** "Fri, 3 Oct 2026 – Sun, 11 Oct 2026 · 9 days" (one day: "Sat, 3 Oct 2026 · 1 day") */
export function detailDates(t: Tournament): string {
    const start = t.date.toLocaleDateString('en-GB', dayFormat);
    const end = t.dateTo ? new Date(t.dateTo) : null;
    const hasEnd = end !== null && !isNaN(end.getTime()) && end > t.date;
    const days = hasEnd ? Math.round((end.getTime() - t.date.getTime()) / 86400000) + 1 : 1;
    const range = hasEnd ? `${start} – ${end.toLocaleDateString('en-GB', dayFormat)}` : start;
    return `${range} · ${days} day${days === 1 ? '' : 's'}`;
}

/** OpenStreetMap + Google Maps links: the exact spot if placed, else a search for the venue text. */
export function mapLinks(t: Tournament): { osm: string; google: string } {
    if (typeof t.lat === 'number' && typeof t.lng === 'number') {
        return {
            osm: `https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=15/${t.lat}/${t.lng}`,
            google: `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`,
        };
    }
    // Not placed: search for the address from chess-results.com, else the venue text
    const q = encodeURIComponent(t.details?.address ?? t.location);
    return {
        osm: `https://www.openstreetmap.org/search?query=${q}`,
        google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    };
}

function row(label: string, valueHTML: string): string {
    return `<div class="detail-row"><dt>${label}</dt><dd>${valueHTML}</dd></div>`;
}

/** "7 rounds · Swiss-System" */
function formatText(t: Tournament): string | null {
    const d = t.details;
    const parts = [d?.rounds ? `${d.rounds} rounds` : '', d?.system ?? ''].filter(Boolean);
    return parts.length ? escapeHTML(parts.join(' · ')) : null;
}

/** "FIDE-rated · national rating" + a link to the FIDE event page */
function ratingHTML(t: Tournament): string | null {
    const d = t.details;
    if (!d?.rated?.length && !d?.fideId) return null;
    const labels = (d.rated ?? []).map(r => /international/i.test(r) ? 'FIDE-rated' : /national/i.test(r) ? 'national rating' : r);
    const fide = d.fideId
        ? ` · <a href="https://ratings.fide.com/tournament_information.phtml?event=${encodeURIComponent(d.fideId)}" target="_blank" rel="noopener noreferrer">FIDE page</a>`
        : '';
    return `${escapeHTML(labels.join(' · ') || 'FIDE-rated')}${fide}`;
}

/** Organizer name + their website */
function organizerHTML(t: Tournament): string | null {
    const d = t.details;
    if (!d?.organizer && !d?.homepage) return null;
    const site = d.homepage
        ? `${d.organizer ? ' · ' : ''}<a href="${escapeHTML(d.homepage)}" target="_blank" rel="noopener noreferrer">Website</a>`
        : '';
    return `${escapeHTML(d.organizer ?? '')}${site}`;
}

function airportText(t: Tournament): string | null {
    const a = t.airport;
    if (a) return `${escapeHTML(a.name)} (${escapeHTML(a.iata)})${a.city ? `, ${escapeHTML(a.city)}` : ''} – about ${a.km} km in a straight line`;
    return typeof t.lat === 'number' ? 'None with airline flights within 150 km' : null;
}

/** Shortlist / calendar / copy-link buttons and the chess-results.com link. */
function actionsHTML(t: Tournament, shortlisted: boolean): string {
    const url = escapeHTML(t.url);
    const name = escapeHTML(t.name);
    return `
        <div class="detail-actions">
            <button type="button" class="shortlist-btn detail-shortlist${shortlisted ? ' shortlisted' : ''}"
                    data-tournament-url="${url}" data-tournament-name="${name}" aria-pressed="${shortlisted}"
                    aria-label="${shortlisted ? 'Remove from' : 'Add to'} shortlist: ${name}">
                <span class="shortlist-star">${shortlisted ? '★' : '☆'}</span> Shortlist
            </button>
            <button type="button" class="calendar-export-btn" data-tournament-url="${url}"
                    aria-haspopup="menu" aria-expanded="false" aria-label="Add ${name} to calendar">📅 Add to calendar</button>
            <button type="button" class="copy-link-btn" data-tournament-url="${url}"
                    aria-label="Copy share link for ${name}">🔗 Copy link</button>
        </div>
        <a class="detail-cr-link" href="${url}" target="_blank" rel="noopener noreferrer">
            Registration, players, pairings and results on chess-results.com →
        </a>
`;
}

/** The panel's inner HTML (pure - unit-tested). */
export function detailPanelHTML(t: Tournament, shortlisted: boolean): string {
    const tc = (t.timeControl ?? '').trim();
    const tcShort = tc ? formatTimeControl(tc) : '';
    const categories = t.category.split(',').map(c => c.trim()).filter(Boolean);
    const maps = mapLinks(t);
    const venue = t.location.replace(/,\s*[A-Z]{3}$/, '');
    // The full address from chess-results.com, when it says more than the venue text
    const address = t.details?.address && !venue.includes(t.details.address) ? t.details.address : '';
    const format = formatText(t);
    const rating = ratingHTML(t);
    const organizer = organizerHTML(t);
    const airport = airportText(t);
    const sea = t.coast
        ? `${SEA_LABELS[t.coast]} coast${t.seaM !== undefined ? ` · 🏖 venue about ${t.seaM} m from the sea` : ''}`
        : null;

    const rows = [
        row('When', escapeHTML(detailDates(t))),
        row('Where', `${formatLocation(t.location, t.town)}${venue && t.town ? `<br><span class="detail-sub">${escapeHTML(venue)}</span>` : ''}${address ? `<br><span class="detail-sub">${escapeHTML(address)}</span>` : ''}
            <br><a href="${escapeHTML(maps.google)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
            · <a href="${escapeHTML(maps.osm)}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>`),
        sea ? row('Seaside', escapeHTML(sea)) : '',
        airport ? row('Nearest airport', airport) : '',
        // The short form ("90+30") first when it is complete; a cut one ("90+30…") adds nothing
        tc ? row('Time control', `${tcShort && tcShort !== tc && !tcShort.endsWith('…') ? `<strong>${escapeHTML(tcShort)}</strong> · ` : ''}${escapeHTML(tc)}`) : '',
        format ? row('Format', format) : '',
        rating ? row('Rating', rating) : '',
        categories.length ? row('Category', categories.map(c => `<span class="category-tag">${escapeHTML(c)}</span>`).join(' ')) : '',
        organizer ? row('Organizer', organizer) : '',
    ].join('');

    const name = escapeHTML(t.name);
    return `<div class="detail-body">
        <div class="detail-header">
            <h2 id="detailTitle" class="detail-title">${name}</h2>
            <button type="button" class="detail-close" aria-label="Close details">✕</button>
        </div>
        <dl class="detail-rows">${rows}</dl>
        ${actionsHTML(t, shortlisted)}
    </div>`;
}

function panel(): HTMLDialogElement | null {
    return document.getElementById(PANEL_ID) as HTMLDialogElement | null;
}

export function isDetailPanelOpen(): boolean {
    const el = panel();
    return !!el && (el.open || el.classList.contains('detail-panel--fallback-open'));
}

/** The tournament the open panel shows (its chess-results URL), or null. */
export function openDetailUrl(): string | null {
    return isDetailPanelOpen() ? panel()?.dataset.tournamentUrl ?? null : null;
}

let returnFocus: HTMLElement | null = null;

/** Open the panel for one tournament; `onShortlist` toggles the ★ inside it. */
export function openDetailPanel(t: Tournament, shortlisted: boolean, onShortlist: (url: string) => void): void {
    const el = panel();
    if (!el) return;
    const wasOpen = isDetailPanelOpen();
    returnFocus = wasOpen ? returnFocus : document.activeElement as HTMLElement | null;
    el.innerHTML = detailPanelHTML(t, shortlisted);
    el.dataset.tournamentUrl = t.url;
    el.querySelector('.detail-close')?.addEventListener('click', () => closeDetailPanel());
    el.querySelector('.detail-shortlist')?.addEventListener('click', () => onShortlist(t.url));

    if (!wasOpen) {
        if (typeof el.showModal === 'function') {
            el.showModal();
        } else {
            el.setAttribute('open', '');
            el.classList.add('detail-panel--fallback-open');
        }
        history.pushState({ [HISTORY_KEY]: t.url }, '', location.href);
    }
    el.querySelector<HTMLElement>('.detail-close')?.focus();
}

/** Close the panel. `fromHistory`: the back button already popped our entry. */
export function closeDetailPanel(fromHistory = false): void {
    const el = panel();
    if (!el || !isDetailPanelOpen()) return;
    if (el.open && typeof el.close === 'function') el.close();
    el.removeAttribute('open');
    el.classList.remove('detail-panel--fallback-open');
    delete el.dataset.tournamentUrl;
    if (!fromHistory && (history.state as Record<string, unknown> | null)?.[HISTORY_KEY]) history.back();
    returnFocus?.focus();
    returnFocus = null;
}

/**
 * Wire the panel once: backdrop click and Escape close it (the native
 * dialog's own Escape "cancel" is routed here so history stays in step),
 * and the back button closes it.
 */
export function initDetailPanel(): void {
    const el = panel();
    if (!el) return;
    el.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeDetailPanel();
    });
    el.addEventListener('click', (e) => {
        if (e.target === el) closeDetailPanel(); // the backdrop: content sits in .detail-body
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.classList.contains('detail-panel--fallback-open')) closeDetailPanel();
    });
    window.addEventListener('popstate', () => closeDetailPanel(true));
}
