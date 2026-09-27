import { FilterSheet } from '../services/FilterSheet';
import { KeyboardPart } from './KeyboardPart';
import { checkedCountryCodes, clearCountries } from '../utils/countrySelection';
import { checkedSeas, initSeaPicker, setCheckedSeas, syncSeaPicker } from '../utils/seaPicker';
import { DEFAULT_SEAS } from '../utils/seas';
export class FilterFormPart extends KeyboardPart {
    initFilterSheet() {
        const card = document.getElementById('filtersSheet');
        const bar = document.getElementById('openFiltersBtn');
        const backdrop = document.getElementById('sheetBackdrop');
        const slot = document.getElementById('mobileQuickFilters');
        const movables = [document.querySelector('.mode-switch'), document.getElementById('activeFilterChips')]
            .filter((el) => el !== null);
        if (!card || !bar || !backdrop || !slot)
            return;
        this.filterSheet = new FilterSheet(card, bar, backdrop, slot, movables, card.querySelector('h2'));
        this.filterSheet.init();
    }
    initCollapsibleFilters() {
        const filtersCard = document.querySelector('.filters-card');
        const savedState = this.cacheManager.loadPreference(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED);
        if (savedState === 'collapsed' && filtersCard) {
            filtersCard.classList.add('collapsed');
            filtersCard.setAttribute('aria-expanded', 'false');
        }
        const filterTitle = document.querySelector('.filters-card h2');
        if (filterTitle && filtersCard) {
            filterTitle.style.cursor = 'pointer';
            filterTitle.setAttribute('role', 'button');
            filterTitle.setAttribute('tabindex', '0');
            const startCollapsed = filtersCard.classList.contains('collapsed');
            filterTitle.setAttribute('aria-expanded', startCollapsed ? 'false' : 'true');
            const toggleFilters = () => {
                if (filtersCard.classList.contains('filters-card--sheet'))
                    return;
                const isCollapsed = filtersCard.classList.toggle('collapsed');
                const expanded = isCollapsed ? 'false' : 'true';
                filtersCard.setAttribute('aria-expanded', expanded);
                filterTitle.setAttribute('aria-expanded', expanded);
                this.cacheManager.savePreference(this.cacheManager.CACHE_KEYS.FILTERS_COLLAPSED, isCollapsed ? 'collapsed' : 'expanded');
            };
            filterTitle.addEventListener('click', toggleFilters);
            filterTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggleFilters();
                }
            });
        }
    }
    initModeSwitch() {
        document.querySelectorAll('.mode-switch-btn').forEach(btn => {
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
    syncModeSwitch() {
        const med = document.getElementById('mediterraneanOnly')?.checked ?? false;
        const senior = document.getElementById('seniorCategory')?.checked ?? false;
        const mode = med && senior ? 'both' : med ? 'seaside' : senior ? 'senior' : 'all';
        syncSeaPicker(med);
        document.querySelectorAll('.mode-switch-btn').forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    }
    getFilterElements() {
        return {
            openOnly: document.getElementById('openOnly'),
            excludeYouth: document.getElementById('excludeYouth'),
            mediterraneanOnly: document.getElementById('mediterraneanOnly'),
            seniorCategory: document.getElementById('seniorCategory'),
            womenOnly: document.getElementById('womenOnly'),
            includeTeamTournaments: document.getElementById('includeTeamTournaments'),
            includeLongEvents: document.getElementById('includeLongEvents'),
            classicalTime: document.getElementById('classicalTime'),
            rapidTime: document.getElementById('rapidTime'),
            blitzTime: document.getElementById('blitzTime'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            minDays: document.getElementById('minDays'),
            seniorS60: document.getElementById('seniorS60'),
            youthCategory: document.getElementById('youthCategory'),
            ratingCategory: document.getElementById('ratingCategory'),
        };
    }
    getFilterState() {
        const elements = this.getFilterElements();
        return {
            openOnly: elements.openOnly?.checked ?? true,
            excludeYouth: elements.excludeYouth?.checked ?? true,
            mediterraneanOnly: elements.mediterraneanOnly?.checked ?? false,
            seas: checkedSeas(),
            seniorCategory: elements.seniorCategory?.checked ?? false,
            womenOnly: elements.womenOnly?.checked ?? false,
            includeTeamTournaments: elements.includeTeamTournaments?.checked ?? false,
            includeLongEvents: elements.includeLongEvents?.checked ?? false,
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
    resetFilters() {
        const el = this.getFilterElements();
        if (el.openOnly)
            el.openOnly.checked = true;
        if (el.excludeYouth)
            el.excludeYouth.checked = true;
        if (el.mediterraneanOnly)
            el.mediterraneanOnly.checked = false;
        setCheckedSeas(DEFAULT_SEAS);
        if (el.seniorCategory)
            el.seniorCategory.checked = false;
        if (el.seniorS60)
            el.seniorS60.checked = false;
        if (el.womenOnly)
            el.womenOnly.checked = false;
        if (el.includeTeamTournaments)
            el.includeTeamTournaments.checked = false;
        if (el.includeLongEvents)
            el.includeLongEvents.checked = false;
        if (el.classicalTime)
            el.classicalTime.checked = true;
        if (el.rapidTime)
            el.rapidTime.checked = true;
        if (el.blitzTime)
            el.blitzTime.checked = true;
        if (el.minDays)
            el.minDays.value = '0';
        if (el.youthCategory)
            el.youthCategory.value = '';
        if (el.ratingCategory)
            el.ratingCategory.value = '';
        clearCountries();
        this.updateCountryFilterSummary();
        const today = new Date();
        const sixMonths = new Date(today);
        sixMonths.setMonth(sixMonths.getMonth() + 6);
        if (el.startDate)
            el.startDate.valueAsDate = today;
        if (el.endDate)
            el.endDate.valueAsDate = sixMonths;
        this.saveFilterPreferences();
        this.syncFilterStateToURL();
        this.syncModeSwitch();
        void this.searchTournaments();
        this.trackEvent('Reset Filters');
    }
    initDatePresets() {
        const startDateEl = document.getElementById('startDate');
        const endDateEl = document.getElementById('endDate');
        if (!startDateEl || !endDateEl)
            return;
        document.querySelectorAll('.date-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const today = new Date();
                const end = new Date(today);
                if (preset === 'month')
                    end.setMonth(end.getMonth() + 1);
                else if (preset === '3months')
                    end.setMonth(end.getMonth() + 3);
                else if (preset === '6months')
                    end.setMonth(end.getMonth() + 6);
                else
                    return;
                startDateEl.valueAsDate = today;
                endDateEl.valueAsDate = end;
                this.handleFilterChange();
            });
        });
    }
}
//# sourceMappingURL=FilterFormPart.js.map