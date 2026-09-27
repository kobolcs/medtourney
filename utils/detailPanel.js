import { escapeHTML } from './html';
import { formatLocation } from './countries';
import { formatTimeControl } from './timeControl';
import { SEA_LABELS } from './seas';
const PANEL_ID = 'tournamentDetail';
const HISTORY_KEY = 'medtourneyDetail';
const dayFormat = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
export function detailDates(t) {
    const start = t.date.toLocaleDateString('en-GB', dayFormat);
    const end = t.dateTo ? new Date(t.dateTo) : null;
    const hasEnd = end !== null && !isNaN(end.getTime()) && end > t.date;
    const days = hasEnd ? Math.round((end.getTime() - t.date.getTime()) / 86400000) + 1 : 1;
    const range = hasEnd ? `${start} – ${end.toLocaleDateString('en-GB', dayFormat)}` : start;
    return `${range} · ${days} day${days === 1 ? '' : 's'}`;
}
export function mapLinks(t) {
    if (typeof t.lat === 'number' && typeof t.lng === 'number') {
        return {
            osm: `https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=15/${t.lat}/${t.lng}`,
            google: `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`,
        };
    }
    const q = encodeURIComponent(t.details?.address ?? t.location);
    return {
        osm: `https://www.openstreetmap.org/search?query=${q}`,
        google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    };
}
function row(label, valueHTML) {
    return `<div class="detail-row"><dt>${label}</dt><dd>${valueHTML}</dd></div>`;
}
function formatText(t) {
    const d = t.details;
    const parts = [d?.rounds ? `${d.rounds} rounds` : '', d?.system ?? ''].filter(Boolean);
    return parts.length ? escapeHTML(parts.join(' · ')) : null;
}
function ratingHTML(t) {
    const d = t.details;
    if (!d?.rated?.length && !d?.fideId)
        return null;
    const labels = (d.rated ?? []).map(r => /international/i.test(r) ? 'FIDE-rated' : /national/i.test(r) ? 'national rating' : r);
    const fide = d.fideId
        ? ` · <a href="https://ratings.fide.com/tournament_information.phtml?event=${encodeURIComponent(d.fideId)}" target="_blank" rel="noopener noreferrer">FIDE page</a>`
        : '';
    return `${escapeHTML(labels.join(' · ') || 'FIDE-rated')}${fide}`;
}
function organizerHTML(t) {
    const d = t.details;
    if (!d?.organizer && !d?.homepage)
        return null;
    const site = d.homepage
        ? `${d.organizer ? ' · ' : ''}<a href="${escapeHTML(d.homepage)}" target="_blank" rel="noopener noreferrer">Website</a>`
        : '';
    return `${escapeHTML(d.organizer ?? '')}${site}`;
}
const shortDateFormat = { weekday: 'short', day: 'numeric', month: 'short' };
function scheduleHTML(t) {
    const rounds = t.details?.schedule;
    if (!rounds?.length)
        return null;
    const items = rounds.map(r => {
        const d = new Date(`${r.date}T12:00:00`);
        const dateStr = d.toLocaleDateString('en-GB', shortDateFormat);
        const timeStr = r.time ? ` · ${r.time}` : '';
        return `<li>Round ${r.round}: ${escapeHTML(dateStr)}${escapeHTML(timeStr)}</li>`;
    }).join('');
    return `<ol class="schedule-list">${items}</ol>`;
}
function airportText(t) {
    const a = t.airport;
    if (a)
        return `${escapeHTML(a.name)} (${escapeHTML(a.iata)})${a.city ? `, ${escapeHTML(a.city)}` : ''} – about ${a.km} km in a straight line`;
    return typeof t.lat === 'number' ? 'None with airline flights within 150 km' : null;
}
function actionsHTML(t, shortlisted) {
    const url = escapeHTML(t.url);
    const name = escapeHTML(t.name);
    const regsUrl = t.details?.regulationsUrl ? escapeHTML(t.details.regulationsUrl) : null;
    return `
        <div class="detail-actions">
            <button type="button" class="shortlist-btn detail-shortlist${shortlisted ? ' shortlisted' : ''}"
                    data-tournament-url="${url}" data-tournament-name="${name}" aria-pressed="${shortlisted}"
                    aria-label="${shortlisted ? 'Remove from' : 'Add to'} shortlist: ${name}">
                <span class="shortlist-star">${shortlisted ? '★' : '☆'}</span> Shortlist
            </button>
            <button type="button" class="calendar-export-btn" data-tournament-url="${url}"
                    aria-haspopup="menu" aria-expanded="false" aria-label="Add ${name} to calendar">📅 Add to calendar</button>
        </div>
        ${regsUrl ? `<a class="detail-regs-link" href="${regsUrl}" target="_blank" rel="noopener noreferrer">📄 Tournament regulations (PDF)</a>` : ''}
        <button type="button" class="detail-cr-link" data-tournament-url="${url}">
            Registration, players, pairings and results →
        </button>
`;
}
export function detailPanelHTML(t, shortlisted) {
    const tc = (t.timeControl ?? '').trim();
    const tcShort = tc ? formatTimeControl(tc) : '';
    const categories = t.category.split(',').map(c => c.trim()).filter(Boolean);
    const maps = mapLinks(t);
    const venue = t.location.replace(/,\s*[A-Z]{3}$/, '');
    const address = t.details?.address && !venue.includes(t.details.address) ? t.details.address : '';
    const format = formatText(t);
    const rating = ratingHTML(t);
    const organizer = organizerHTML(t);
    const airport = airportText(t);
    const sea = t.coast
        ? `${SEA_LABELS[t.coast]} coast${t.seaM !== undefined ? ` · 🏖 venue about ${t.seaM} m from the sea` : ''}`
        : null;
    const schedule = scheduleHTML(t);
    const rows = [
        row('When', escapeHTML(detailDates(t))),
        row('Where', `${formatLocation(t.location, t.town)}${venue && t.town ? `<br><span class="detail-sub">${escapeHTML(venue)}</span>` : ''}${address ? `<br><span class="detail-sub">${escapeHTML(address)}</span>` : ''}
            <br><a href="${escapeHTML(maps.google)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
            · <a href="${escapeHTML(maps.osm)}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>`),
        sea ? row('Seaside', escapeHTML(sea)) : '',
        airport ? row('Nearest airport', airport) : '',
        tc ? row('Time control', `${tcShort && tcShort !== tc && !tcShort.endsWith('…') ? `<strong>${escapeHTML(tcShort)}</strong> · ` : ''}${escapeHTML(tc)}`) : '',
        format ? row('Format', format) : '',
        schedule ? row('Schedule', schedule) : '',
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
function panel() {
    return document.getElementById(PANEL_ID);
}
export function isDetailPanelOpen() {
    const el = panel();
    return !!el && (el.open || el.classList.contains('detail-panel--fallback-open'));
}
export function openDetailUrl() {
    return isDetailPanelOpen() ? panel()?.dataset.tournamentUrl ?? null : null;
}
let returnFocus = null;
export function openDetailPanel(t, shortlisted, onShortlist) {
    const el = panel();
    if (!el)
        return;
    const wasOpen = isDetailPanelOpen();
    returnFocus = wasOpen ? returnFocus : document.activeElement;
    el.innerHTML = detailPanelHTML(t, shortlisted);
    el.dataset.tournamentUrl = t.url;
    el.querySelector('.detail-close')?.addEventListener('click', () => closeDetailPanel());
    el.querySelector('.detail-shortlist')?.addEventListener('click', () => onShortlist(t.url));
    el.querySelector('.detail-cr-link')?.addEventListener('click', () => window.open(t.url, '_blank', 'noopener,noreferrer'));
    if (!wasOpen) {
        if (typeof el.showModal === 'function') {
            el.showModal();
        }
        else {
            el.setAttribute('open', '');
            el.classList.add('detail-panel--fallback-open');
        }
        const panelUrl = new URL(location.href);
        panelUrl.searchParams.set('t', t.url);
        history.pushState({ [HISTORY_KEY]: t.url }, '', panelUrl.toString());
    }
    el.querySelector('.detail-close')?.focus();
}
export function closeDetailPanel(fromHistory = false) {
    const el = panel();
    if (!el || !isDetailPanelOpen())
        return;
    if (el.open && typeof el.close === 'function')
        el.close();
    el.removeAttribute('open');
    el.classList.remove('detail-panel--fallback-open');
    delete el.dataset.tournamentUrl;
    if (!fromHistory && history.state?.[HISTORY_KEY])
        history.back();
    returnFocus?.focus();
    returnFocus = null;
}
export function initDetailPanel() {
    const el = panel();
    if (!el)
        return;
    el.addEventListener('cancel', (e) => {
        e.preventDefault();
        closeDetailPanel();
    });
    el.addEventListener('click', (e) => {
        if (e.target === el)
            closeDetailPanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.classList.contains('detail-panel--fallback-open'))
            closeDetailPanel();
    });
    window.addEventListener('popstate', () => closeDetailPanel(true));
}
//# sourceMappingURL=detailPanel.js.map