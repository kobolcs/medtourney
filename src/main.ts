/**
 * Main entry point for Vite build
 *
 * This file serves as the entry point when using Vite for building.
 * It imports and initializes the TournamentFinder application.
 */

// Import styles
import '../styles.css';

// Import the application
// Note: The app.ts file is self-initializing via DOMContentLoaded
import './app';
import { initFeedbackLink } from './utils/contact';

// Footer "Feedback" link (hidden until an address is set in utils/contact.ts)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initFeedbackLink());
} else {
    initFeedbackLink();
}

// The app will auto-initialize when DOM is ready
console.log('✓ MedTourney application loaded via Vite');
