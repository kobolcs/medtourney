/**
 * TournamentFinder, part: FilterFormPart
 *
 * One link in TournamentFinder's class chain (src/app.ts): AppState ->
 * ThemeHelpPart -> DataFreshnessPart -> FilterPreferencesPart -> ActiveFilterChipsPart -> CountryFilterPart -> EmptyStatePart -> ShortlistPart -> CardActionsPart -> KeyboardPart -> FilterFormPart -> ResultsViewPart ->
 * TournamentFinder. Methods moved unchanged out of app.ts.
 */
import { FilterState } from '../types';
import { FilterSheet } from '../services/FilterSheet';
import type { FilterElements } from './AppState';
import { KeyboardPart } from './KeyboardPart';
import { checkedCountryCodes, clearCountries } from '../utils/countrySelection';
import { checkedSeas, initSeaPicker, setCheckedSeas, syncSeaPicker } from '../utils/seaPicker';
import { DEFAULT_SEAS } from '../utils/seas';

/** The filter form: elements, state, reset, mode switch, date presets, collapsible panel, phone sheet. */
export abstract class FilterFormPart extends KeyboardPart {
    /**
     * Initialize collapsible filters
     */
    /** Phones: filters in a bottom sheet (see FilterSheet). */
    protected initFilterSheet(): void {
        const card = document.getElementById('filtersSheet');
        const bar = document.getElementById('openFiltersBtn') as HTMLButtonElement | null;
        const backdrop = document.getElementById('sheetBackdrop');
        const slot = document.getElementById('mobileQuickFilters');
        const movables = [document.querySelector<HTMLElement>('.mode-switch'), document.getElementById('activeFilterChips')]
            .filter((el): el is HTMLElement => el !== null);
        if (!card || !bar || !backdrop || !slot) return;
        this.filterSheet = new FilterSheet(card, bar, backdrop, slot, movables, card.querySelector('h2'));
        this.filterSheet.init();
    }

    protected initCollapsibleFilters(): void {
        const filtersCard = document.querySelector('.filters-card');
        const savedState = this.cacheManager.loadPreference<string>(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED);

        if (savedState === 'collapsed' && filtersCard) {
            filtersCard.classList.add('collapsed');
            filtersCard.setAttribute('aria-expanded', 'false');
        }

        const filterTitle = document.querySelector<HTMLElement>('.filters-card h2');
        if (filterTitle && filtersCard) {
            // Make the heading an operable, keyboard-accessible toggle button
            // (WCAG 2.1.1 Keyboard + 4.1.2 Name, Role, Value).
            filterTitle.style.cursor = 'pointer';
            filterTitle.setAttribute('role', 'button');
            filterTitle.setAttribute('tabindex', '0');
            const startCollapsed = filtersCard.classList.contains('collapsed');
            filterTitle.setAttribute('aria-expanded', startCollapsed ? 'false' : 'true');

            const toggleFilters = (): void => {
                // Phones: the card is a bottom sheet (FilterSheet), not collapsible
                if (filtersCard.classList.contains('filters-card--sheet')) return;
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                const expanded = isCollapsed ? 'false' : 'true';
                filtersCard.setAttribute('aria-expanded', expanded);
                filterTitle.setAttribute('aria-expanded', expanded);

                // Save state
                this.cacheManager.savePreference(
                    this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED,
                    isCollapsed ? 'collapsed' : 'expanded'
                );
            };

            filterTitle.addEventListener('click', toggleFilters);
            filterTitle.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggleFilters();
                }
            });
        }
    }

    /**
     * The "All Europe / Seaside / Senior 50+ / Both" segmented control is a
     * convenience front door onto the existing mediterraneanOnly + seniorCategory
     * checkboxes (which stay the source of truth, still directly reachable -
     * seniorCategory lives in the "More filters" drawer for anyone who wants
     * just that one control). Clicking a mode sets both checkboxes at once;
     * syncModeSwitch() keeps the segmented control's active state honest when
     * the checkboxes change some other way (drawer, URL load, reset).
     */
    protected initModeSwitch(): void {
        document.querySelectorAll<HTMLButtonElement>('.mode-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode ?? 'all';
                this.setCheckbox('mediterraneanOnly', mode === 'seaside' || mode === 'both');
                this.setCheckbox('seniorCategory', mode === 'senior' || mode === 'both');
                this.handleFilterChange();
                this.trackEvent('Mode Switch', { mode });
            });
        });
        initSeaPicker(() => this.handleFilterChange());
    }

    protected syncModeSwitch(): void {
        const med = (document.getElementById('mediterraneanOnly') as HTMLInputElement | null)?.checked ?? false;
        const senior = (document.getElementById('seniorCategory') as HTMLInputElement | null)?.checked ?? false;
        const mode = med && senior ? 'both' : med ? 'seaside' : senior ? 'senior' : 'all';
        syncSeaPicker(med);

        document.querySelectorAll<HTMLButtonElement>('.mode-switch-btn').forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    }

    /**
     * Get all filter element references
     */
    protected getFilterElements(): FilterElements {
        return {
            openOnly: document.getElementById('openOnly') as HTMLInputElement | null,
            excludeYouth: document.getElementById('excludeYouth') as HTMLInputElement | null,
            mediterraneanOnly: document.getElementById('mediterraneanOnly') as HTMLInputElement | null,
            seniorCategory: document.getElementById('seniorCategory') as HTMLInputElement | null,
            womenOnly: document.getElementById('womenOnly') as HTMLInputElement | null,
            includeTeamTournaments: document.getElementById('includeTeamTournaments') as HTMLInputElement | null,
            classicalTime: document.getElementById('classicalTime') as HTMLInputElement | null,
            rapidTime: document.getElementById('rapidTime') as HTMLInputElement | null,
            blitzTime: document.getElementById('blitzTime') as HTMLInputElement | null,
            startDate: document.getElementById('startDate') as HTMLInputElement | null,
            endDate: document.getElementById('endDate') as HTMLInputElement | null,
            minDays: document.getElementById('minDays') as HTMLSelectElement | null,
            seniorS60: document.getElementById('seniorS60') as HTMLInputElement | null,
            youthCategory: document.getElementById('youthCategory') as HTMLSelectElement | null,
            ratingCategory: document.getElementById('ratingCategory') as HTMLSelectElement | null,
        };
    }

    /**
     * Get current filter state from UI
     */
    protected getFilterState(): FilterState {
        const elements = this.getFilterElements();

        return {
            openOnly: elements.openOnly?.checked ?? true,
            excludeYouth: elements.excludeYouth?.checked ?? true,
            mediterraneanOnly: elements.mediterraneanOnly?.checked ?? false,
            seas: checkedSeas(),
            seniorCategory: elements.seniorCategory?.checked ?? false,
            womenOnly: elements.womenOnly?.checked ?? false,
            includeTeamTournaments: elements.includeTeamTournaments?.checked ?? false,
            classicalTime: elements.classicalTime?.checked ?? true,
            rapidTime: elements.rapidTime?.checked ?? true,
            blitzTime: elements.blitzTime?.checked ?? true,
            startDate: elements.startDate?.valueAsDate ?? null,
            endDate: elements.endDate?.valueAsDate ?? null,
            countryFilter: checkedCountryCodes(),
            minDays: elements.minDays?.value === 'weekend' ? 'weekend'
                : elements.minDays?.value === 'just-weekend' ? 'just-weekend'
                : (parseInt(elements.minDays?.value ?? '0', 10) || 0),
            seniorS60: elements.seniorS60?.checked ?? false,
            youthCategory: elements.youthCategory?.value ?? '',
            ratingCategory: elements.ratingCategory?.value ?? '',
        };
    }

    /** Reset all filter inputs to their default values and re-run the search. */
    protected resetFilters(): void {
        const el = this.getFilterElements();
        if (el.openOnly)              el.openOnly.checked              = true;
        if (el.excludeYouth)          el.excludeYouth.checked          = true;
        if (el.mediterraneanOnly)     el.mediterraneanOnly.checked     = false;
        setCheckedSeas(DEFAULT_SEAS);
        if (el.seniorCategory)        el.seniorCategory.checked        = false;
        if (el.seniorS60)             el.seniorS60.checked             = false;
        if (el.womenOnly)             el.womenOnly.checked             = false;
        if (el.includeTeamTournaments) el.includeTeamTournaments.checked = false;
        if (el.classicalTime)         el.classicalTime.checked         = true;
        if (el.rapidTime)             el.rapidTime.checked             = true;
        if (el.blitzTime)             el.blitzTime.checked             = true;
        if (el.minDays)               el.minDays.value                 = '0';
        if (el.youthCategory)         el.youthCategory.value           = '';
        if (el.ratingCategory)        el.ratingCategory.value          = '';

        // Clear country checkboxes
        clearCountries();
        this.updateCountryFilterSummary();

        // Reset dates to today → 6 months
        const today = new Date();
        const sixMonths = new Date(today);
        sixMonths.setMonth(sixMonths.getMonth() + 6);
        if (el.startDate) el.startDate.valueAsDate = today;
        if (el.endDate)   el.endDate.valueAsDate   = sixMonths;

        this.saveFilterPreferences();
        this.syncFilterStateToURL();
        this.syncModeSwitch();
        void this.searchTournaments();
        this.trackEvent('Reset Filters');
    }

    /**
     * Wire up date preset buttons (Next Month / 3 Months / 6 Months)
     */
    protected initDatePresets(): void {
        const startDateEl = document.getElementById('startDate') as HTMLInputElement | null;
        const endDateEl = document.getElementById('endDate') as HTMLInputElement | null;
        if (!startDateEl || !endDateEl) return;

        document.querySelectorAll<HTMLButtonElement>('.date-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const today = new Date();
                const end = new Date(today);

                if (preset === 'month') end.setMonth(end.getMonth() + 1);
                else if (preset === '3months') end.setMonth(end.getMonth() + 3);
                else if (preset === '6months') end.setMonth(end.getMonth() + 6);
                else return;

                startDateEl.valueAsDate = today;
                endDateEl.valueAsDate = end;
            });
        });
    }
}
