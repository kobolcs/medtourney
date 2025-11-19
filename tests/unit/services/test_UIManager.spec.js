/**
 * Unit tests for UIManager with jsdom
 * Tests DOM manipulation, rendering, and UI state management
 */

const { JSDOM } = require('jsdom');

// Create a browser-like environment
function setupDOM() {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <div id="loading" style="display: none;"></div>
            <div id="error" style="display: none;"></div>
            <div id="results" style="display: none;">
                <div id="resultsCount"></div>
                <div id="tournamentList"></div>
            </div>
            <button id="exportBtn" style="display: none;"></button>
        </body>
        </html>
    `, {
        url: 'http://localhost'
    });

    global.document = dom.window.document;
    global.window = dom.window;
    return dom;
}

// Simple UIManager implementation for testing
class UIManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredTournaments = [];
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    showLoadingSkeletons() {
        const tournamentList = document.getElementById('tournamentList');
        const results = document.getElementById('results');

        if (!tournamentList || !results) return;

        results.style.display = 'block';
        tournamentList.innerHTML = '';

        for (let i = 0; i < 6; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.setAttribute('aria-hidden', 'true');
            skeleton.setAttribute('data-skeleton', 'true');
            skeleton.innerHTML = `
                <div class="skeleton-title"></div>
                <div class="skeleton-location"></div>
                <div class="skeleton-date"></div>
            `;
            tournamentList.appendChild(skeleton);
        }
    }

    displayTournaments(tournaments) {
        this.filteredTournaments = tournaments;
        this.currentPage = 1;
        this.renderResults();
    }

    updateDisplayedTournaments(tournaments) {
        this.filteredTournaments = tournaments;
        this.renderResults();
    }

    renderResults() {
        const tournamentList = document.getElementById('tournamentList');
        const results = document.getElementById('results');
        const resultsCount = document.getElementById('resultsCount');

        if (!tournamentList || !results) return;

        // Clear loading skeletons
        tournamentList.innerHTML = '';
        results.style.display = 'block';

        if (this.filteredTournaments.length === 0) {
            this.showEmptyState();
            return;
        }

        // Update count
        if (resultsCount) {
            resultsCount.textContent = `Found ${this.filteredTournaments.length} tournament(s)`;
        }

        // Render tournaments
        this.filteredTournaments.forEach(tournament => {
            const card = this.createTournamentCard(tournament);
            tournamentList.appendChild(card);
        });

        // Show export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.style.display = 'block';
        }
    }

    createTournamentCard(tournament) {
        const card = document.createElement('div');
        card.className = 'tournament-card';
        card.innerHTML = `
            <h3>${tournament.name}</h3>
            <p class="location">${tournament.location}</p>
            <p class="date">${tournament.date.toLocaleDateString()}</p>
            <p class="category">${tournament.category}</p>
        `;
        return card;
    }

    showEmptyState() {
        const tournamentList = document.getElementById('tournamentList');
        const resultsCount = document.getElementById('resultsCount');

        if (resultsCount) {
            resultsCount.textContent = 'No tournaments found';
        }

        if (tournamentList) {
            tournamentList.innerHTML = '<p class="empty-state">Try adjusting your filters</p>';
        }
    }

    showError(message, type = 'error') {
        const errorDiv = document.getElementById('error');
        if (!errorDiv) return;

        errorDiv.textContent = message;
        errorDiv.className = `error-message ${type}`;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    toggleDarkMode() {
        document.body.classList.toggle('dark-theme');
    }

    updateResultsCount(count) {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = `Found ${count} tournament(s)`;
        }
    }
}

// Test suite
function runTests() {
    console.log('\n🧪 Running UIManager Unit Tests (with jsdom)\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            // Setup fresh DOM for each test
            setupDOM();
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.log(`❌ ${name}`);
            console.log(`   Error: ${error.message}`);
            failed++;
        } finally {
            // Cleanup
            delete global.document;
            delete global.window;
        }
    }

    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected "${expected}", got "${actual}"`);
        }
    }

    function assertContains(str, substring, message) {
        if (!str.includes(substring)) {
            throw new Error(`${message || 'Assertion failed'}: "${str}" does not contain "${substring}"`);
        }
    }

    // Test 1: Show loading indicator
    test('Show loading indicator', () => {
        const ui = new UIManager();
        ui.showLoading();

        const loading = document.getElementById('loading');
        assertEqual(loading.style.display, 'block');
    });

    // Test 2: Hide loading indicator
    test('Hide loading indicator', () => {
        const ui = new UIManager();
        ui.showLoading();
        ui.hideLoading();

        const loading = document.getElementById('loading');
        assertEqual(loading.style.display, 'none');
    });

    // Test 3: Show loading skeletons
    test('Show loading skeletons', () => {
        const ui = new UIManager();
        ui.showLoadingSkeletons();

        const tournamentList = document.getElementById('tournamentList');
        const skeletons = tournamentList.querySelectorAll('.skeleton-card');

        assertEqual(skeletons.length, 6);
        assertEqual(skeletons[0].getAttribute('aria-hidden'), 'true');
    });

    // Test 4: Display tournaments
    test('Display tournaments', () => {
        const ui = new UIManager();
        const tournaments = [
            {
                name: 'Barcelona Open',
                location: 'Barcelona, ESP',
                date: new Date('2025-06-01'),
                category: 'Open'
            },
            {
                name: 'Athens Rapid',
                location: 'Athens, GRE',
                date: new Date('2025-07-01'),
                category: 'Rapid'
            }
        ];

        ui.displayTournaments(tournaments);

        const tournamentList = document.getElementById('tournamentList');
        const cards = tournamentList.querySelectorAll('.tournament-card');

        assertEqual(cards.length, 2);
        assertContains(cards[0].textContent, 'Barcelona Open');
        assertContains(cards[1].textContent, 'Athens Rapid');
    });

    // Test 5: Show empty state
    test('Show empty state when no tournaments', () => {
        const ui = new UIManager();
        ui.displayTournaments([]);

        const resultsCount = document.getElementById('resultsCount');
        const tournamentList = document.getElementById('tournamentList');

        assertEqual(resultsCount.textContent, 'No tournaments found');
        assertContains(tournamentList.innerHTML, 'Try adjusting your filters');
    });

    // Test 6: Update results count
    test('Update results count', () => {
        const ui = new UIManager();
        ui.updateResultsCount(42);

        const resultsCount = document.getElementById('resultsCount');
        assertEqual(resultsCount.textContent, 'Found 42 tournament(s)');
    });

    // Test 7: Show error message
    test('Show error message', () => {
        const ui = new UIManager();
        ui.showError('Test error message');

        const errorDiv = document.getElementById('error');
        assertEqual(errorDiv.textContent, 'Test error message');
        assertEqual(errorDiv.style.display, 'block');
        assertContains(errorDiv.className, 'error');
    });

    // Test 8: Show warning message
    test('Show warning message', () => {
        const ui = new UIManager();
        ui.showError('Test warning', 'warning');

        const errorDiv = document.getElementById('error');
        assertContains(errorDiv.className, 'warning');
    });

    // Test 9: Toggle dark mode
    test('Toggle dark mode', () => {
        const ui = new UIManager();

        // Initially no dark theme
        assertEqual(document.body.classList.contains('dark-theme'), false);

        // Toggle on
        ui.toggleDarkMode();
        assertEqual(document.body.classList.contains('dark-theme'), true);

        // Toggle off
        ui.toggleDarkMode();
        assertEqual(document.body.classList.contains('dark-theme'), false);
    });

    // Test 10: Create tournament card
    test('Create tournament card with correct structure', () => {
        const ui = new UIManager();
        const tournament = {
            name: 'Test Tournament',
            location: 'Test Location, ESP',
            date: new Date('2025-06-01'),
            category: 'Open'
        };

        const card = ui.createTournamentCard(tournament);

        assertContains(card.className, 'tournament-card');
        assertContains(card.innerHTML, 'Test Tournament');
        assertContains(card.innerHTML, 'Test Location, ESP');
        assertContains(card.innerHTML, 'Open');
    });

    // Test 11: Clear skeletons when displaying tournaments
    test('Clear loading skeletons when displaying tournaments', () => {
        const ui = new UIManager();

        // Show skeletons first
        ui.showLoadingSkeletons();
        const tournamentList = document.getElementById('tournamentList');
        let skeletons = tournamentList.querySelectorAll('.skeleton-card');
        assertEqual(skeletons.length, 6);

        // Display tournaments
        ui.displayTournaments([{
            name: 'Test',
            location: 'Test, ESP',
            date: new Date('2025-06-01'),
            category: 'Open'
        }]);

        // Skeletons should be gone
        skeletons = tournamentList.querySelectorAll('.skeleton-card');
        assertEqual(skeletons.length, 0);

        // Real cards should be present
        const cards = tournamentList.querySelectorAll('.tournament-card');
        assertEqual(cards.length, 1);
    });

    // Test 12: Show export button when tournaments displayed
    test('Show export button when tournaments displayed', () => {
        const ui = new UIManager();
        const tournaments = [{
            name: 'Test',
            location: 'Test, ESP',
            date: new Date('2025-06-01'),
            category: 'Open'
        }];

        ui.displayTournaments(tournaments);

        const exportBtn = document.getElementById('exportBtn');
        assertEqual(exportBtn.style.display, 'block');
    });

    // Test 13: Update displayed tournaments
    test('Update displayed tournaments without resetting page', () => {
        const ui = new UIManager();
        ui.currentPage = 3;

        const tournaments = [{
            name: 'Test',
            location: 'Test, ESP',
            date: new Date('2025-06-01'),
            category: 'Open'
        }];

        ui.updateDisplayedTournaments(tournaments);

        // Page should not reset
        assertEqual(ui.currentPage, 3);
        assertEqual(ui.filteredTournaments.length, 1);
    });

    // Test 14: Tournament card has date formatted
    test('Tournament card displays formatted date', () => {
        const ui = new UIManager();
        const tournament = {
            name: 'Test',
            location: 'Test, ESP',
            date: new Date('2025-06-15'),
            category: 'Open'
        };

        const card = ui.createTournamentCard(tournament);
        // Date should be formatted (exact format depends on locale)
        assertContains(card.innerHTML, '2025');
    });

    // Test 15: Results display is shown
    test('Results display becomes visible', () => {
        const ui = new UIManager();
        const results = document.getElementById('results');

        // Initially hidden
        assertEqual(results.style.display, 'none');

        ui.displayTournaments([{
            name: 'Test',
            location: 'Test, ESP',
            date: new Date('2025-06-01'),
            category: 'Open'
        }]);

        // Should be visible now
        assertEqual(results.style.display, 'block');
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

// Run tests
process.exit(runTests());
