/**
 * UIManager, part: StatusViewsPart
 *
 * One link in UIManager's class chain (src/services/UIManager.ts): UIState ->
 * CardPart -> PaginationPart -> StatusViewsPart -> UIManager.
 * Methods moved unchanged out of UIManager.ts.
 */
import { escapeHTML } from '../../utils/html';
import { PaginationPart } from './PaginationPart';

/** Loading, empty, error and staleness states. */
export abstract class StatusViewsPart extends PaginationPart {
    /**
     * Show loading spinner
     */
    showLoading(): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
        }
    }

    /**
     * Hide loading spinner
     */
    hideLoading(): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Display loading skeletons while fetching data
     */
    showLoadingSkeletons(): void {
        const tournamentList = document.getElementById('tournamentList');
        const results = document.getElementById('results');

        if (!tournamentList || !results) return;

        // Show results container
        results.style.display = 'block';

        // Clear existing content
        tournamentList.innerHTML = '';

        // Create 6 skeleton cards
        for (let i = 0; i < 6; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.setAttribute('aria-hidden', 'true');
            skeleton.setAttribute('data-skeleton', 'true');

            skeleton.innerHTML = `
                <div class="skeleton-title"></div>
                <div class="skeleton-location"></div>
                <div class="skeleton-date"></div>
                <div class="skeleton-category"></div>
            `;

            tournamentList.appendChild(skeleton);
        }

        // Update results count
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = 'Loading tournaments...';
            resultsCount.setAttribute('aria-live', 'polite');
        }

        // Hide export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.style.display = 'none';
        }
    }

    showStalenessBanner(message: string): void {
        const banner = document.getElementById('staleness-banner');
        if (banner) {
            banner.textContent = message;
            banner.style.display = 'block';
        }
    }

    /**
     * Show empty state, using any context set by prepareEmptyState().
     */
    protected showEmptyState(container: HTMLElement): void {
        const ctx = this.emptyStateContext;
        this.emptyStateContext = null;

        const countLine = ctx && ctx.totalCount > 0
            ? `<p class="empty-state-message empty-state-count">0 of ${ctx.totalCount.toLocaleString()} tournaments match your filters.</p>`
            : `<p class="empty-state-message">We couldn't find any tournaments matching your current filters.</p>`;

        const relaxations = ctx?.relaxations ?? [];

        const relaxationItems = relaxations.length > 0
            ? relaxations.map((r, i) => `
                <li>
                    <button type="button" class="empty-state-relaxation-btn" data-relaxation-index="${i}">
                        ${escapeHTML(r.label)} <span class="empty-state-relaxation-count">(${r.count.toLocaleString()})</span>
                    </button>
                </li>
            `).join('')
            : ['Expand the date range', 'Remove some filter criteria', 'Try a different country or location']
                .map(s => `<li>${escapeHTML(s)}</li>`)
                .join('');

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">🔍</div>
                <h3 class="empty-state-title">No Tournaments Found</h3>
                ${countLine}
                <div class="empty-state-suggestions">
                    <h4>${relaxations.length > 0 ? 'One-tap fixes:' : 'Try adjusting your filters:'}</h4>
                    <ul>${relaxationItems}</ul>
                </div>
                <div class="empty-state-actions">
                    <button class="reset-filters-btn" id="resetFiltersBtn">
                        <span aria-hidden="true">🔄</span> Reset All Filters
                    </button>
                </div>
                <p class="empty-state-info">
                    <small>Tournament data is updated daily from chess-results.com</small>
                </p>
            </div>
        `;
    }

    /**
     * Show error message
     */
    showError(message: string, type: 'error' | 'warning' | 'success' = 'error', onRetry?: () => void): void {
        const error = document.getElementById('error');
        if (!error) return;

        error.textContent = message;
        error.className = `error-message ${type}-type`;
        error.style.display = 'block';

        // With live filtering there's no Search button to press again, so a
        // failed load offers its own retry.
        if (onRetry) {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'error-retry-btn';
            retry.textContent = 'Try again';
            retry.addEventListener('click', () => {
                error.style.display = 'none';
                onRetry();
            });
            error.append(' ', retry);
        }

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                error.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Hide error message
     */
    hideError(): void {
        const error = document.getElementById('error');
        if (error) {
            error.style.display = 'none';
        }
    }
}
