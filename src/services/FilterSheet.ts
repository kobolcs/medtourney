import { Logger } from '../utils/Logger';

/**
 * Phones and tablets (<= 1023px): the filters card becomes a bottom sheet, so results come
 * first. One form, no duplication - the same .filters-card is restyled and
 * gets dialog semantics while in sheet mode; the Seaside/Senior mode switch
 * and the active-filter chips (the site's front door) are moved out of it
 * into a slot above the results. A "Filters (N)" bar opens the sheet; the
 * card's own "Show N tournaments" button closes it. Wider screens are left
 * exactly as they are (DOM order included).
 */

// Up to the desktop sidebar breakpoint (1024px): tablets get the sheet too
export const SHEET_QUERY = '(max-width: 1023px)';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

interface Moved {
    el: HTMLElement;
    placeholder: Comment;
}

export class FilterSheet {
    private readonly logger = Logger.createScoped('FilterSheet');
    private readonly mq: MediaQueryList;
    private sheetMode = false;
    private open = false;
    private moved: Moved[] = [];
    private savedCard: { role: string | null; collapsed: boolean; ariaExpanded: string | null } | null = null;
    private savedHeading: { role: string | null; tabindex: string | null; ariaExpanded: string | null } | null = null;

    constructor(
        private readonly card: HTMLElement,
        private readonly bar: HTMLButtonElement,
        private readonly backdrop: HTMLElement,
        private readonly slot: HTMLElement,
        private readonly movables: HTMLElement[],
        private readonly heading: HTMLElement | null,
    ) {
        this.mq = window.matchMedia(SHEET_QUERY);
    }

    init(): void {
        this.mq.addEventListener('change', e => this.setSheetMode(e.matches));
        this.setSheetMode(this.mq.matches);

        this.bar.addEventListener('click', () => this.show());
        this.backdrop.addEventListener('click', () => this.hide());
        this.card.querySelector('.sheet-close')?.addEventListener('click', () => this.hide());
        this.card.addEventListener('keydown', e => this.onKeydown(e));
    }

    isSheetMode(): boolean {
        return this.sheetMode;
    }

    isOpen(): boolean {
        return this.open;
    }

    private activeCount = 0;
    private resultCount: number | null = null;

    /** "Filters (3)" - N = active-filter chips (dates and time control included). */
    setCount(count: number): void {
        this.activeCount = count;
        this.renderBarLabel();
    }

    /**
     * "· 30 tournaments" on the bar: on a phone the results heading with the
     * count is often under the bar (or below a tall featured card), so the
     * bar carries it too.
     */
    setResultCount(count: number): void {
        this.resultCount = count;
        this.renderBarLabel();
    }

    private renderBarLabel(): void {
        const active = this.bar.querySelector('.open-filters-count');
        if (active) active.textContent = this.activeCount > 0 ? ` (${this.activeCount})` : '';
        const results = this.bar.querySelector('.open-filters-results');
        const n = this.resultCount;
        const resultsText = n === null ? '' : `${n.toLocaleString('en-GB')} tournament${n === 1 ? '' : 's'}`;
        if (results) results.textContent = resultsText ? ` · ${resultsText}` : '';
        const activeText = this.activeCount > 0 ? `, ${this.activeCount} active` : '';
        this.bar.setAttribute('aria-label', `Filters${activeText}${resultsText ? `. Showing ${resultsText}` : ''}`);
    }

    show(): void {
        if (!this.sheetMode || this.open) return;
        this.open = true;
        this.card.inert = false;
        this.card.classList.add('is-open');
        this.backdrop.hidden = false;
        document.body.classList.add('sheet-open');
        this.bar.setAttribute('aria-expanded', 'true');
        this.card.querySelector<HTMLElement>('.sheet-close')?.focus();
    }

    /** Close the sheet; focus returns to the Filters bar unless told otherwise. */
    hide(returnFocus = true): void {
        if (!this.open) return;
        this.open = false;
        this.card.classList.remove('is-open');
        this.card.inert = true;
        this.backdrop.hidden = true;
        document.body.classList.remove('sheet-open');
        this.bar.setAttribute('aria-expanded', 'false');
        if (returnFocus) this.bar.focus();
    }

    private setSheetMode(on: boolean): void {
        if (on === this.sheetMode) return;
        if (!on) this.hide(false);
        this.sheetMode = on;
        if (on) this.enter();
        else this.leave();
        this.logger.debug(`Sheet mode ${on ? 'on' : 'off'}`);
    }

    private enter(): void {
        // Front-door controls stay on the page, above the results
        this.moved = this.movables.map(el => {
            const placeholder = document.createComment('filter-sheet placeholder');
            el.replaceWith(placeholder);
            this.slot.appendChild(el);
            return { el, placeholder };
        });
        this.slot.hidden = false;

        // Dialog semantics instead of the card's search landmark; a collapsed
        // state saved by the old phone "Search Filters" toggle would otherwise
        // open an empty sheet
        this.savedCard = {
            role: this.card.getAttribute('role'),
            collapsed: this.card.classList.contains('collapsed'),
            ariaExpanded: this.card.getAttribute('aria-expanded'),
        };
        this.card.classList.remove('collapsed');
        this.card.removeAttribute('aria-expanded');
        this.card.setAttribute('role', 'dialog');
        this.card.setAttribute('aria-modal', 'true');
        this.card.classList.add('filters-card--sheet');
        this.card.inert = true;

        if (this.heading) {
            this.savedHeading = {
                role: this.heading.getAttribute('role'),
                tabindex: this.heading.getAttribute('tabindex'),
                ariaExpanded: this.heading.getAttribute('aria-expanded'),
            };
            for (const attr of ['role', 'tabindex', 'aria-expanded']) this.heading.removeAttribute(attr);
        }

        this.bar.hidden = false;
        this.bar.setAttribute('aria-expanded', 'false');
    }

    private leave(): void {
        for (const { el, placeholder } of this.moved) placeholder.replaceWith(el);
        this.moved = [];
        this.slot.hidden = true;

        this.card.classList.remove('filters-card--sheet', 'is-open');
        this.card.inert = false;
        this.card.removeAttribute('aria-modal');
        if (this.savedCard) {
            restoreAttr(this.card, 'role', this.savedCard.role);
            restoreAttr(this.card, 'aria-expanded', this.savedCard.ariaExpanded);
            this.card.classList.toggle('collapsed', this.savedCard.collapsed);
        }
        if (this.heading && this.savedHeading) {
            restoreAttr(this.heading, 'role', this.savedHeading.role);
            restoreAttr(this.heading, 'tabindex', this.savedHeading.tabindex);
            restoreAttr(this.heading, 'aria-expanded', this.savedHeading.ariaExpanded);
        }
        this.bar.hidden = true;
    }

    /** Escape closes; Tab cycles inside the open sheet (modal focus trap). */
    private onKeydown(e: KeyboardEvent): void {
        if (!this.open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.hide();
            return;
        }
        if (e.key !== 'Tab') return;
        const focusable = Array.from(this.card.querySelectorAll<HTMLElement>(FOCUSABLE))
            .filter(el => el.offsetParent !== null);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
}

function restoreAttr(el: HTMLElement, name: string, value: string | null): void {
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
}
