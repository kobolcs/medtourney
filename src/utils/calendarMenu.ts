/**
 * The small menu a card's calendar button opens: "Google Calendar" (a link
 * to Google's event form) or "Download .ics" (handled by CardActionsPart).
 * One menu at a time, positioned under its button against the viewport so it
 * also works in the Tournament of the Week banner.
 */
import type { Tournament } from '../types';
import { escapeHTML } from './html';
import { googleCalendarUrl } from './googleCalendar';

let openFor: HTMLElement | null = null;
let openedAtScrollY = 0;
/** Scrolling further than this closes the menu (it is fixed under its button) */
const CLOSE_ON_SCROLL_PX = 40;

/** Close the open menu; `refocus` returns focus to its button (Escape, a choice). */
export function closeCalendarMenu(refocus = false): void {
    document.querySelector('.calendar-menu')?.remove();
    if (openFor) {
        openFor.setAttribute('aria-expanded', 'false');
        if (refocus) openFor.focus();
    }
    openFor = null;
}

/** Open (or, if already open for this button, close) the menu for one tournament. */
export function openCalendarMenu(button: HTMLElement, tournament: Tournament): void {
    const wasOpen = openFor === button;
    closeCalendarMenu();
    if (wasOpen) return;

    const menu = document.createElement('div');
    menu.className = 'calendar-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Add ${tournament.name} to a calendar`);
    menu.dataset.tournamentUrl = tournament.url;
    menu.innerHTML = `
        <a class="calendar-menu-item" role="menuitem" data-action="google"
           href="${escapeHTML(googleCalendarUrl(tournament))}" target="_blank" rel="noopener noreferrer">
            Google Calendar
        </a>
        <button type="button" class="calendar-menu-item" role="menuitem" data-action="ics">
            Download .ics <small>Outlook, Apple, Thunderbird</small>
        </button>`;

    const rect = button.getBoundingClientRect();
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
    menu.style.left = `${Math.round(Math.max(8, Math.min(rect.left, window.innerWidth - 240)))}px`;
    // Inside the detail panel's modal <dialog> (the top layer) - anything
    // outside it would stay behind it whatever its z-index
    (button.closest('dialog') ?? document.body).appendChild(menu);
    // Near the bottom of the screen: open upwards instead of off-screen
    if (rect.bottom + 4 + menu.offsetHeight > window.innerHeight - 8) {
        menu.style.top = `${Math.round(Math.max(8, rect.top - 4 - menu.offsetHeight))}px`;
    }

    button.setAttribute('aria-expanded', 'true');
    openFor = button;
    openedAtScrollY = window.scrollY;
    menu.querySelector<HTMLElement>('.calendar-menu-item')?.focus({ preventScroll: true });
}

/**
 * Scroll handler: close only after a real scroll away. Focus moves and small
 * layout shifts fire scroll events too, and must not shut the menu at once.
 */
export function closeCalendarMenuOnScroll(): void {
    if (openFor && Math.abs(window.scrollY - openedAtScrollY) > CLOSE_ON_SCROLL_PX) closeCalendarMenu();
}
