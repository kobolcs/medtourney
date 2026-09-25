/**
 * UIManager, part: PaginationPart
 *
 * One link in UIManager's class chain (src/services/UIManager.ts): UIState ->
 * CardPart -> PaginationPart -> StatusViewsPart -> UIManager.
 * Methods moved unchanged out of UIManager.ts.
 */
import { CardPart } from './CardPart';

/** Pagination controls under the results. */
export abstract class PaginationPart extends CardPart {
    /**
     * Render pagination controls
     */
    protected renderPagination(container: HTMLElement): void {
        const totalPages = Math.ceil(this.filteredTournaments.length / this.itemsPerPage);

        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination-container';

        // Pagination info
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredTournaments.length);

        paginationDiv.innerHTML = `
            <div class="pagination-info" aria-live="polite" aria-atomic="true">
                Showing ${startIndex}-${endIndex} of ${this.filteredTournaments.length} tournaments
            </div>
            <div class="pagination-controls" role="navigation" aria-label="Tournament pagination">
                <button class="pagination-btn"
                        data-page="prev"
                        ${this.currentPage === 1 ? 'disabled' : ''}
                        aria-label="Previous page">
                    ← Previous
                </button>
                ${this.generatePageButtons(totalPages)}
                <button class="pagination-btn"
                        data-page="next"
                        ${this.currentPage === totalPages ? 'disabled' : ''}
                        aria-label="Next page">
                    Next →
                </button>
            </div>
        `;

        container.appendChild(paginationDiv);

        // Add event listeners
        this.attachPaginationListeners(paginationDiv, totalPages);
    }

    /**
     * Generate page number buttons
     */
    protected generatePageButtons(totalPages: number): string {
        const buttons: string[] = [];
        const maxButtons = 7;

        if (totalPages <= maxButtons) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                buttons.push(this.createPageButton(i));
            }
        } else {
            // Show first, last, current, and nearby pages
            buttons.push(this.createPageButton(1));

            if (this.currentPage > 3) {
                buttons.push('<span class="pagination-ellipsis">...</span>');
            }

            const start = Math.max(2, this.currentPage - 1);
            const end = Math.min(totalPages - 1, this.currentPage + 1);

            for (let i = start; i <= end; i++) {
                buttons.push(this.createPageButton(i));
            }

            if (this.currentPage < totalPages - 2) {
                buttons.push('<span class="pagination-ellipsis">...</span>');
            }

            buttons.push(this.createPageButton(totalPages));
        }

        return buttons.join('');
    }

    /**
     * Create page button HTML
     */
    protected createPageButton(page: number): string {
        const isActive = page === this.currentPage;
        return `
            <button class="pagination-btn ${isActive ? 'active' : ''}"
                    data-page="${page}"
                    ${isActive ? 'aria-current="page"' : ''}
                    aria-label="Page ${page}">
                ${page}
            </button>
        `;
    }

    /**
     * Attach pagination event listeners
     */
    protected attachPaginationListeners(container: HTMLElement, totalPages: number): void {
        const buttons = container.querySelectorAll('.pagination-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const page = target.getAttribute('data-page');

                if (page === 'prev' && this.currentPage > 1) {
                    this.currentPage--;
                    this.renderResults();
                } else if (page === 'next' && this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderResults();
                } else if (page && !isNaN(parseInt(page))) {
                    this.currentPage = parseInt(page);
                    this.renderResults();
                }

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }
}
