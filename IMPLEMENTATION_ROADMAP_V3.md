# MedTourney 3.0 Implementation Roadmap
## Detailed Execution Plan

**Created:** 2025-11-18
**Last Updated:** 2025-11-18
**Status:** ✅ **Phase 1 & Phase 2 (Partial) COMPLETED**
**Success Probability:** 55-60%
**Total Timeline:** 3-6 months
**Total Effort:** 240-370 hours

## 🎉 IMPLEMENTATION STATUS

| Phase | Status | Completion Date | Details |
|-------|--------|----------------|---------|
| **Phase 1** | ✅ **COMPLETED** | 2025-11-18 | SEO, Mobile UX, Empty States |
| **Phase 2.1** | ✅ **COMPLETED** | 2025-11-18 | Filter Persistence (localStorage) |
| **Phase 2.2** | ✅ **COMPLETED** | 2025-11-18 | Calendar Export (.ics files) |
| **Phase 2.3** | ⏭️ **SKIPPED** | N/A | Email Alerts (deferred) |
| **Phase 2.4** | ✅ **COMPLETED** | 2025-11-18 | Scraper Optimization (6mo, 5000 results) |
| **Phase 3** | 📅 **PENDING** | TBD | Scale & Optimize |

### Completed Features (v2.3.0)
- ✅ Comprehensive SEO (meta tags, sitemap.xml, robots.txt, Schema.org)
- ✅ Mobile-first UX (48x48px touch targets, sticky search button)
- ✅ Enhanced empty states with contextual suggestions
- ✅ Filter persistence across sessions (localStorage)
- ✅ Calendar export (.ics files, RFC 5545 compliant)
- ✅ Scraper optimization (6 months coverage, 5000 result limit)
- ✅ Test coverage: 41 tests, 97.6% pass rate

### Next Steps
- 📋 Phase 1: Marketing & Launch (Reddit, chess.com forums)
- 📋 Phase 2.3: Email Alerts (if user demand exists)
- 📋 Phase 3: Additional data sources (FIDE, ECU)

---

## Current Project Status ✅

### ✅ **GOOD NEWS: Critical Issues Already Fixed!**

| Issue | Status | Details |
|-------|--------|---------|
| **tournaments_data.json empty** | ✅ **RESOLVED** | 38 tournaments, 13KB, updated 2025-11-18 11:55 UTC |
| **Daily scraper working** | ✅ **WORKING** | GitHub Actions runs at 00:00 UTC daily |
| **Data quality** | ✅ **GOOD** | 11 countries, dates Nov 26 - Jan 17 |
| **App functionality** | ✅ **FUNCTIONAL** | No deployment blockers |

**Conclusion:** The "critical deployment issue" from the code review has been resolved. The app is functional!

---

## Phase 1: Quick Wins & Launch (Weeks 1-4)

**Goal:** Maximize value with minimal effort
**Timeline:** 4 weeks
**Effort:** 60-80 hours
**Cost:** $0-20

---

### Week 1: Foundation & SEO (16-20 hours)

#### Task 1.1: Add Privacy-Friendly Analytics ⭐ **HIGH PRIORITY**
**Why:** Can't improve what you don't measure
**Effort:** 3-4 hours
**Cost:** $0 (self-hosted) or $9/month (Plausible cloud)

**Implementation:**

1. **Option A: Plausible Analytics (Cloud)** ✅ **RECOMMENDED**
   - Sign up at plausible.io ($9/month)
   - Add script tag to index.html
   - No cookies, GDPR-compliant

   ```html
   <!-- Add before </head> in index.html -->
   <script defer data-domain="kobolcs.github.io" src="https://plausible.io/js/script.js"></script>
   ```

2. **Option B: Self-Hosted Plausible** (Free but more complex)
   - Requires Docker hosting
   - Save for Phase 2 if budget is $0

**Metrics to Track:**
- Page views, unique visitors
- Top pages, referrer sources
- Country distribution
- Device type (mobile vs desktop)

**Success Criteria:**
- Analytics tracking within 24 hours
- Can see real-time visitor data
- No impact on page load speed (<100ms)

---

#### Task 1.2: SEO Optimization ⭐ **HIGH PRIORITY**
**Why:** Enable organic discovery via search engines
**Effort:** 4-6 hours
**Cost:** $0

**Changes Needed:**

**A. Meta Tags (index.html)**
```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>MedTourney - European Chess Tournament Finder | Mediterranean & Senior Events</title>
  <meta name="title" content="MedTourney - European Chess Tournament Finder">
  <meta name="description" content="Find European chess tournaments with advanced filters for Mediterranean locations, senior categories (S50+), and vacation-friendly events. Fast, mobile-friendly, 100% free.">
  <meta name="keywords" content="chess tournaments europe, mediterranean chess, senior chess tournaments, S50 chess, european chess events, chess vacation, seaside chess tournaments">
  <meta name="robots" content="index, follow">
  <meta name="language" content="English">
  <meta name="author" content="MedTourney">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://kobolcs.github.io/medtourney/">
  <meta property="og:title" content="MedTourney - European Chess Tournament Finder">
  <meta property="og:description" content="Find European chess tournaments with advanced filters for Mediterranean locations, senior categories (S50+), and vacation-friendly events.">
  <meta property="og:image" content="https://kobolcs.github.io/medtourney/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://kobolcs.github.io/medtourney/">
  <meta property="twitter:title" content="MedTourney - European Chess Tournament Finder">
  <meta property="twitter:description" content="Find European chess tournaments with advanced filters for Mediterranean locations, senior categories (S50+).">
  <meta property="twitter:image" content="https://kobolcs.github.io/medtourney/og-image.png">
</head>
```

**B. Add Schema.org Structured Data**
```html
<!-- Add before </body> in index.html -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "MedTourney",
  "description": "European chess tournament discovery platform with advanced filtering",
  "url": "https://kobolcs.github.io/medtourney/",
  "applicationCategory": "SportsApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "audience": {
    "@type": "Audience",
    "audienceType": "Chess Players",
    "geographicArea": {
      "@type": "Place",
      "name": "Europe"
    }
  }
}
</script>
```

**C. Create sitemap.xml**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://kobolcs.github.io/medtourney/</loc>
    <lastmod>2025-11-18</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

**D. Create robots.txt**
```
User-agent: *
Allow: /
Sitemap: https://kobolcs.github.io/medtourney/sitemap.xml
```

**E. Create Open Graph Image**
- Design 1200×630px image with:
  - "MedTourney" logo/text
  - "Find European Chess Tournaments"
  - Visual of chess piece + map/beach
- Tool: Canva (free) or Figma
- Save as `og-image.png` in root

**Success Criteria:**
- Google can crawl and index the site
- Rich previews work on social media (Twitter, Facebook, WhatsApp)
- Search Console shows no errors

---

#### Task 1.3: Improve Mobile UX ⭐ **HIGH PRIORITY**
**Why:** 50%+ of users will be on mobile
**Effort:** 6-8 hours
**Cost:** $0

**Changes:**

**A. Increase Touch Targets (styles.css)**
```css
/* Current: Some buttons are 40px, too small */
/* Fix: Minimum 48×48px for all interactive elements */

.pagination-btn {
  min-width: 48px;  /* Was 40px */
  min-height: 48px;
  padding: 12px 16px;
  font-size: 16px;
}

button, .btn, input[type="submit"] {
  min-height: 48px;
  padding: 12px 20px;
}

/* Make checkboxes and their labels easier to tap */
.filter-item {
  padding: 12px 8px;  /* More padding */
  min-height: 48px;
}

input[type="checkbox"] {
  width: 24px;  /* Was 16px */
  height: 24px;
  margin-right: 12px;
}

label {
  cursor: pointer;
  padding: 8px;  /* Makes entire label clickable */
}
```

**B. Fix Horizontal Scrolling on Small Screens**
```css
/* Add breakpoint for very small screens */
@media (max-width: 320px) {
  .date-range {
    grid-template-columns: 1fr; /* Stack vertically instead of side-by-side */
    gap: 12px;
  }

  .filter-section {
    padding: 12px 8px;  /* Reduce padding */
  }

  .tournament-card {
    padding: 12px;  /* Reduce padding */
  }
}
```

**C. Sticky Search Button (Mobile)**
```css
/* Add sticky search button on mobile for easier access */
@media (max-width: 768px) {
  .search-button-container {
    position: sticky;
    bottom: 20px;
    z-index: 100;
    padding: 0 16px;
  }

  .search-tournaments-btn {
    width: 100%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
}
```

**D. Improve Filter Drawer UX**
```css
@media (max-width: 768px) {
  .filters {
    /* Current: Fixed position
    /* Improvement: Slide-up drawer with better UX */
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    overflow-y: auto;
    background: white;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .filters.open {
    transform: translateY(0);
  }

  /* Add handle for dragging */
  .filters::before {
    content: '';
    display: block;
    width: 40px;
    height: 4px;
    background: #ccc;
    border-radius: 2px;
    margin: 12px auto 16px;
  }
}
```

**Success Criteria:**
- All touch targets ≥48×48px
- No horizontal scrolling on screens ≥320px wide
- Lighthouse mobile score >90
- Passes mobile-friendly test (Google)

---

#### Task 1.4: Enhanced Empty State Messages ⭐ **MEDIUM PRIORITY**
**Why:** Better UX when no results found
**Effort:** 2-3 hours
**Cost:** $0

**Implementation (src/app.ts):**

```typescript
private showEmptyState(filters: FilterState): void {
  const tournamentList = document.getElementById('tournament-list');
  if (!tournamentList) return;

  const hasActiveFilters = this.hasActiveFilters(filters);

  if (hasActiveFilters) {
    // User has filters applied but no results
    tournamentList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No tournaments match your filters</h3>
        <p>Try adjusting your search criteria:</p>
        <ul class="suggestions">
          <li>Expand your date range</li>
          <li>Remove some category filters</li>
          <li>Try different countries</li>
          <li>Disable "Mediterranean only" if enabled</li>
        </ul>
        <button onclick="window.tournamentFinder.resetFilters()" class="btn-secondary">
          Reset All Filters
        </button>
      </div>
    `;
  } else {
    // No tournaments in database (scraper issue)
    tournamentList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>No Tournament Data Available</h3>
        <p>Tournament data is updated automatically every day at 00:00 UTC.</p>
        <p class="text-muted">
          Last update: <strong>${this.getLastUpdateTime()}</strong>
        </p>
        <p>The scraper may be running or updating. Please check back in a few minutes.</p>
        <a href="https://github.com/kobolcs/medtourney#data-scraper"
           target="_blank"
           class="help-link">
          Learn more about how data updates work →
        </a>
      </div>
    `;
  }
}

private hasActiveFilters(filters: FilterState): boolean {
  return filters.openOnly ||
         filters.mediterraneanOnly ||
         filters.seniorOnly ||
         filters.countries.length > 0 ||
         // ... check other filters
}

private getLastUpdateTime(): string {
  // Get from tournaments_data.json metadata or git commit
  return 'Checking...'; // TODO: Implement
}
```

**Add CSS:**
```css
.empty-state {
  text-align: center;
  padding: 60px 20px;
  max-width: 600px;
  margin: 0 auto;
}

.empty-state-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.empty-state h3 {
  font-size: 24px;
  color: #333;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 16px;
  color: #666;
  margin-bottom: 12px;
}

.empty-state .suggestions {
  text-align: left;
  max-width: 400px;
  margin: 24px auto;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
}

.empty-state .suggestions li {
  margin: 8px 0;
  color: #555;
}

.btn-secondary {
  margin-top: 20px;
  background: #6c757d;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.btn-secondary:hover {
  background: #5a6268;
}

.help-link {
  display: inline-block;
  margin-top: 16px;
  color: #007bff;
  text-decoration: none;
}

.help-link:hover {
  text-decoration: underline;
}
```

**Success Criteria:**
- Helpful empty state shown when no results
- Clear suggestions for users
- Reset filters button works
- Users understand why no results

---

### Week 2: Marketing & Launch (16-20 hours)

#### Task 2.1: Create Marketing Materials ⭐ **HIGH PRIORITY**
**Effort:** 4-5 hours
**Cost:** $0

**A. Screenshot/Demo GIF**
- Record screen showing:
  1. Landing page
  2. Applying filters (Mediterranean + S50+)
  3. Finding relevant tournament
  4. Clicking through to chess-results.com
- Tool: LICEcap (Windows/Mac) or Peek (Linux)
- Max 3MB GIF for Reddit/forums

**B. Value Proposition Document**
```markdown
# MedTourney - Why It's Better

## Problem with chess-results.com:
- ❌ Terrible mobile UX (unusable on phones)
- ❌ Can't filter Mediterranean + Senior together
- ❌ Youth tournaments clutter results
- ❌ No way to exclude non-European events
- ❌ Website feels like it's from 2005

## MedTourney Solution:
- ✅ Mobile-first design (actually works on phones!)
- ✅ Combine any filters (Mediterranean + S50+ + Open)
- ✅ Auto-exclude youth-only tournaments
- ✅ European focus (11 countries and growing)
- ✅ Modern, fast, clean interface
- ✅ 100% free, no ads, no tracking

## Unique Features:
1. 🏖️ **Mediterranean filter** - Find seaside tournaments
2. 👴 **Senior categories** - S50, S60, S65 at a glance
3. 📱 **Mobile-optimized** - Unlike chess-results.com
4. ⚡ **Lightning fast** - No page reloads
5. 🆓 **Completely free** - Open source project
```

---

#### Task 2.2: Reddit Launch ⭐ **CRITICAL**
**Effort:** 6-8 hours (post creation + engagement)
**Cost:** $0
**Potential Reach:** 100-500 users

**Target Subreddits:**

1. **/r/chess** (500K members) - Main launch
2. **/r/ChessPuzzles** (100K members) - Secondary
3. **/r/AnarchyChess** (400K members) - If content is humorous
4. **/r/sideproject** (200K members) - Tech-focused
5. National subreddits: /r/spain, /r/germany, /r/greece (if relevant)

**Post Template:**
```markdown
**Title:** I built a better way to find European chess tournaments [Free Tool]

**Body:**

Hey /r/chess! 👋

I got frustrated with chess-results.com's terrible UX (especially on mobile), so I built **MedTourney** - a modern, fast, mobile-friendly European chess tournament finder.

## What makes it different:

🏖️ **Mediterranean filter** - Find tournaments in Barcelona, Nice, Athens, etc.
👴 **Senior categories** - Easily see S50+, S60+, S65+ sections
📱 **Actually works on mobile** - Unlike chess-results.com
⚡ **Lightning fast** - Client-side filtering, no page reloads
🆓 **100% free** - No ads, no tracking, open source

## Example use cases:

- "I want a chess vacation in a Mediterranean city" → Filter for seaside + classical
- "I'm 62 and want to play S60+" → Filter for senior categories
- "Show me all tournaments in Spain next month" → Country + date filter

## Try it: https://kobolcs.github.io/medtourney/

Built with TypeScript, updates daily via automated scraping, covers 11 European countries (and growing).

**Feedback welcome!** Let me know what features you'd like to see added.

_Note: This complements chess-results.com (doesn't replace it). You still register on their site - this just makes finding relevant tournaments way easier._

[Include screenshot/GIF]
```

**Engagement Strategy:**
- Post during peak hours (10am-2pm EST, weekdays)
- Respond to ALL comments within first 2 hours
- Be humble, ask for feedback
- Don't be defensive if criticized
- Offer to add requested features

**Success Criteria:**
- 50+ upvotes (good)
- 200+ upvotes (great)
- 500+ upvotes (viral!)
- 100+ visits from Reddit
- 5+ feature requests/feedback comments

---

#### Task 2.3: Chess.com Forums ⭐ **HIGH PRIORITY**
**Effort:** 3-4 hours
**Cost:** $0
**Potential Reach:** 50-200 users

**Target Forums:**
1. **General Chess Discussion** - Main forum
2. **Tournament** - Direct relevance
3. **Computer Chess** - Tech-savvy audience
4. Regional forums (Europe, Spain, Germany, etc.)

**Post Template:**
```
Subject: Free European Tournament Finder (Better Mobile UX than chess-results)

I built a tool to make finding European chess tournaments easier:
https://kobolcs.github.io/medtourney/

Key features:
- Mediterranean & seaside tournament filter
- Senior category search (S50+, S60+, etc.)
- Mobile-friendly (unlike chess-results.com)
- Free, no ads

Covers 11 European countries, updates daily. Feedback appreciated!

[Screenshot]
```

---

#### Task 2.4: Facebook Groups ⭐ **MEDIUM PRIORITY**
**Effort:** 2-3 hours
**Cost:** $0
**Potential Reach:** 30-100 users

**Target Groups:**
1. European Chess Players
2. Senior Chess Players International
3. National chess groups (Spain Chess Players, German Chess Federation, etc.)
4. Chess Tournament Announcements

**Post shorter version:**
```
Found: Free tool to find European chess tournaments with better UX than chess-results.com

Features:
✅ Mediterranean & seaside filter
✅ Senior categories (S50+)
✅ Mobile-friendly
✅ 100% free

Try it: https://kobolcs.github.io/medtourney/

Feedback welcome!
```

---

### Week 3-4: Monitor, Iterate, Fix (24-30 hours)

#### Task 3.1: User Feedback Collection ⭐ **HIGH PRIORITY**
**Effort:** 8-10 hours (ongoing)
**Cost:** $0

**Actions:**
1. Monitor Reddit/chess.com comments
2. Set up GitHub Issues for bug reports
3. Create simple feedback form (Google Forms or Typeform)
4. Track analytics daily

**Questions to Answer:**
- What filters do users use most?
- What's the bounce rate?
- Which pages do users exit from?
- Are people finding tournaments?
- What features are requested most?

---

#### Task 3.2: Bug Fixes & Quick Improvements ⭐ **HIGH PRIORITY**
**Effort:** 12-16 hours
**Cost:** $0

**Based on User Feedback:**
- Fix any UI bugs discovered
- Improve filter combinations that don't work well
- Add small UX improvements
- Fix mobile issues found in testing

---

#### Task 3.3: Content Creation (Optional) ⚠️ **MEDIUM PRIORITY**
**Effort:** 4-6 hours
**Cost:** $0

**Blog Posts (if adding content):**
1. "Top 10 Mediterranean Chess Tournaments in 2025"
2. "Guide to European Senior Chess Tournaments"
3. "How to Plan a Chess Vacation in Europe"

**Publish on:**
- Medium.com (free)
- Dev.to (free)
- Own GitHub Pages blog (Jekyll)

**SEO Value:** High - drive organic traffic

---

## Phase 1 Success Criteria ✅

By end of Week 4, achieve:
- ✅ 100+ monthly active users
- ✅ Analytics installed and tracking
- ✅ SEO improvements deployed
- ✅ Mobile UX optimized
- ✅ Reddit/chess.com posts live
- ✅ 10+ pieces of user feedback collected
- ✅ 0 critical bugs

**Decision Point:** If <50 users after 4 weeks, reassess marketing strategy

---

## Phase 2: High-Value Features (Weeks 5-12)

**Goal:** Add features users actually want
**Timeline:** 8 weeks
**Effort:** 80-120 hours
**Cost:** $0-25/month

---

### Feature 2.1: Calendar Export (.ics files) ⭐ **HIGH VALUE**
**Why:** Easy to implement, high user value
**Effort:** 8-12 hours
**Cost:** $0
**Priority:** **HIGH**

**User Story:**
> "As a chess player, I want to export tournaments to my Google Calendar so I can track deadlines and plan my schedule."

**Implementation:**

**A. Add Export Button to Tournament Card**
```typescript
// In src/app.ts

private generateTournamentCard(tournament: Tournament): string {
  return `
    <div class="tournament-card" data-id="${tournament.id}">
      <!-- existing card content -->

      <div class="tournament-actions">
        <a href="${tournament.url}" target="_blank" class="btn-primary">
          View Details →
        </a>
        <button onclick="window.tournamentFinder.exportToCalendar('${tournament.id}')"
                class="btn-secondary btn-icon">
          📅 Add to Calendar
        </button>
      </div>
    </div>
  `;
}

public exportToCalendar(tournamentId: string): void {
  const tournament = this.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return;

  const icsContent = this.generateICS(tournament);
  this.downloadICS(icsContent, `${tournament.name}.ics`);
}

private generateICS(tournament: Tournament): string {
  const startDate = tournament.startDate.replace(/-/g, '');
  const endDate = tournament.endDate.replace(/-/g, '');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MedTourney//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${tournament.id}@medtourney
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${this.escapeICS(tournament.name)}
DESCRIPTION:${this.escapeICS(tournament.description)}\\n\\nRegister: ${tournament.url}
LOCATION:${this.escapeICS(tournament.location)}
URL:${tournament.url}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-P7D
ACTION:DISPLAY
DESCRIPTION:Tournament registration reminder - ${tournament.name}
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

private escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

private downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

**B. Add "Export All Filtered" Button**
```typescript
public exportAllFiltered(): void {
  const filtered = this.getFilteredTournaments();

  if (filtered.length === 0) {
    alert('No tournaments to export. Try adjusting your filters.');
    return;
  }

  if (filtered.length > 50) {
    if (!confirm(`Export ${filtered.length} tournaments? This may take a moment.`)) {
      return;
    }
  }

  const icsContent = this.generateMultipleICS(filtered);
  this.downloadICS(icsContent, 'medtourney-tournaments.ics');
}

private generateMultipleICS(tournaments: Tournament[]): string {
  const events = tournaments.map(t => this.generateEventVCALENDAR(t)).join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MedTourney//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events}
END:VCALENDAR`;
}
```

**Success Criteria:**
- Export button appears on every tournament card
- Downloads .ics file that opens in Google Calendar, Apple Calendar, Outlook
- Includes tournament details, location, URL
- Reminder set for 7 days before tournament
- Works on mobile and desktop

---

### Feature 2.2: Filter Persistence (localStorage) ⭐ **MEDIUM VALUE**
**Why:** Convenience for returning users
**Effort:** 4-8 hours
**Cost:** $0
**Priority:** MEDIUM

**Implementation:**

```typescript
// In src/app.ts

private STORAGE_KEY = 'medtourney_filters_v1';

private saveFilterState(): void {
  const state: FilterState = this.getCurrentFilterState();
  try {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save filter state:', e);
  }
}

private loadFilterState(): FilterState | null {
  try {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as FilterState;
    }
  } catch (e) {
    console.warn('Failed to load filter state:', e);
  }
  return null;
}

private restoreFilters(state: FilterState): void {
  // Set date inputs
  const startDate = document.getElementById('startDate') as HTMLInputElement;
  const endDate = document.getElementById('endDate') as HTMLInputElement;
  if (startDate && state.startDate) startDate.valueAsDate = new Date(state.startDate);
  if (endDate && state.endDate) endDate.valueAsDate = new Date(state.endDate);

  // Set checkboxes
  const openOnly = document.getElementById('openOnly') as HTMLInputElement;
  const mediterraneanOnly = document.getElementById('mediterraneanOnly') as HTMLInputElement;
  const seniorOnly = document.getElementById('seniorOnly') as HTMLInputElement;

  if (openOnly) openOnly.checked = state.openOnly;
  if (mediterraneanOnly) mediterraneanOnly.checked = state.mediterraneanOnly;
  if (seniorOnly) seniorOnly.checked = state.seniorOnly;

  // ... restore other filters
}

// Call on filter change
private onFilterChange(): void {
  this.saveFilterState();
  this.filterAndDisplayTournaments();
}

// Call on page load
public async initialize(): Promise<void> {
  await this.loadConfig();
  await this.loadTournaments();

  const savedState = this.loadFilterState();
  if (savedState) {
    this.restoreFilters(savedState);
  }

  this.setupEventListeners();
  this.filterAndDisplayTournaments();
}
```

**Add UI Indicator:**
```html
<!-- Show when filters are restored -->
<div id="filters-restored-notice" class="notice" style="display: none;">
  ✅ Your previous filters have been restored.
  <button onclick="window.tournamentFinder.resetFilters()">Reset</button>
</div>
```

**Success Criteria:**
- Filters persist across page reloads
- Works in private/incognito mode (localStorage available)
- User can easily reset to defaults
- No performance impact

---

### Feature 2.3: Email Alerts (Basic) ⭐ **HIGH VALUE**
**Why:** Brings users back, high engagement
**Effort:** 16-24 hours
**Cost:** $0-10/month (Mailgun free tier: 5,000 emails/month)
**Priority:** MEDIUM-HIGH

**Architecture (Lightweight):**

```
User subscribes → Store in Supabase (free tier)
↓
Daily cron (GitHub Actions) runs at 01:00 UTC
↓
Check for new tournaments matching saved filters
↓
Send email via Mailgun if matches found
```

**Implementation:**

**A. Subscription Form (index.html)**
```html
<div class="email-alerts-section">
  <h3>📧 Get Tournament Alerts</h3>
  <p>Be notified when new tournaments match your filters</p>

  <form id="subscribe-form" class="subscribe-form">
    <input type="email"
           id="subscribe-email"
           placeholder="your.email@example.com"
           required>
    <button type="submit" class="btn-primary">
      Subscribe
    </button>
  </form>

  <p class="privacy-note">
    <small>
      We'll only email you about new tournaments.
      Unsubscribe anytime. No spam. Privacy-first.
    </small>
  </p>
</div>
```

**B. Supabase Setup (Free Tier)**
1. Create account at supabase.com
2. Create table `subscriptions`:
   ```sql
   CREATE TABLE subscriptions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     email TEXT UNIQUE NOT NULL,
     filters JSONB NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     last_sent_at TIMESTAMP,
     active BOOLEAN DEFAULT TRUE,
     unsubscribe_token TEXT UNIQUE
   );
   ```

**C. Subscription Logic (new file: `alert-service.ts`)**
```typescript
// This runs in browser to subscribe users
export class AlertService {
  private supabaseUrl = 'YOUR_SUPABASE_URL';
  private supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

  async subscribe(email: string, filters: FilterState): Promise<void> {
    const unsubscribeToken = this.generateToken();

    const response = await fetch(`${this.supabaseUrl}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${this.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        filters,
        unsubscribe_token: unsubscribeToken
      })
    });

    if (!response.ok) {
      throw new Error('Subscription failed');
    }
  }

  private generateToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
```

**D. Email Sending (GitHub Actions - new workflow)**

Create `.github/workflows/send-alerts.yml`:
```yaml
name: Send Tournament Alerts

on:
  schedule:
    - cron: '0 1 * * *'  # Run at 01:00 UTC (after scraper)
  workflow_dispatch:

jobs:
  send-alerts:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install requests python-dateutil

      - name: Send alerts
        env:
          MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}
          MAILGUN_DOMAIN: ${{ secrets.MAILGUN_DOMAIN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          python3 scripts/send_alerts.py
```

**E. Alert Sending Script (`scripts/send_alerts.py`)**
```python
import os
import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict

MAILGUN_API_KEY = os.environ['MAILGUN_API_KEY']
MAILGUN_DOMAIN = os.environ['MAILGUN_DOMAIN']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']

def get_subscriptions() -> List[Dict]:
    """Fetch active subscriptions from Supabase"""
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/subscriptions",
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        },
        params={'active': 'eq.true'}
    )
    return response.json()

def get_new_tournaments() -> List[Dict]:
    """Load tournaments added in last 24 hours"""
    with open('tournaments_data.json', 'r') as f:
        tournaments = json.load(f)

    # In production, filter by last_added timestamp
    # For now, return all tournaments
    return tournaments

def filter_tournaments(tournaments: List[Dict], filters: Dict) -> List[Dict]:
    """Apply user's saved filters"""
    filtered = []
    for t in tournaments:
        if filters.get('seniorOnly') and 'S50+' not in t.get('category', ''):
            continue
        if filters.get('mediterraneanOnly'):
            # Check if location is Mediterranean
            med_cities = ['Barcelona', 'Valencia', 'Nice', 'Cannes', 'Athens', 'Malta']
            if not any(city in t['location'] for city in med_cities):
                continue
        # ... apply other filters
        filtered.append(t)

    return filtered

def send_email(email: str, tournaments: List[Dict], unsubscribe_token: str):
    """Send email via Mailgun"""
    if not tournaments:
        return

    subject = f"🎯 {len(tournaments)} new chess tournament(s) match your filters"

    html_body = f"""
    <h2>New Tournaments Found!</h2>
    <p>We found {len(tournaments)} new tournament(s) matching your saved filters:</p>
    <ul>
    """

    for t in tournaments[:10]:  # Max 10 in email
        html_body += f"""
        <li>
          <strong>{t['name']}</strong><br>
          📍 {t['location']}<br>
          📅 {t['date']}<br>
          <a href="{t['url']}">View Details →</a>
        </li>
        """

    html_body += f"""
    </ul>
    <hr>
    <p><small>
      <a href="https://kobolcs.github.io/medtourney/unsubscribe?token={unsubscribe_token}">
        Unsubscribe
      </a>
    </small></p>
    """

    requests.post(
        f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
        auth=("api", MAILGUN_API_KEY),
        data={
            "from": f"MedTourney Alerts <noreply@{MAILGUN_DOMAIN}>",
            "to": email,
            "subject": subject,
            "html": html_body
        }
    )

def main():
    subscriptions = get_subscriptions()
    new_tournaments = get_new_tournaments()

    for sub in subscriptions:
        email = sub['email']
        filters = sub['filters']

        matching = filter_tournaments(new_tournaments, filters)

        if matching:
            send_email(email, matching, sub['unsubscribe_token'])
            print(f"Sent {len(matching)} tournaments to {email}")

if __name__ == '__main__':
    main()
```

**F. Unsubscribe Page (unsubscribe.html)**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Unsubscribe - MedTourney</title>
</head>
<body>
  <h1>Unsubscribe from Tournament Alerts</h1>
  <p id="message">Processing...</p>

  <script>
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      document.getElementById('message').textContent = 'Invalid unsubscribe link.';
    } else {
      // Call Supabase to deactivate subscription
      fetch(`YOUR_SUPABASE_URL/rest/v1/subscriptions?unsubscribe_token=eq.${token}`, {
        method: 'PATCH',
        headers: {
          'apikey': 'YOUR_ANON_KEY',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: false })
      })
      .then(() => {
        document.getElementById('message').innerHTML =
          '✅ You have been unsubscribed. You will no longer receive alerts.<br><a href="/">Return to MedTourney</a>';
      })
      .catch(() => {
        document.getElementById('message').textContent = '❌ Failed to unsubscribe. Please try again.';
      });
    }
  </script>
</body>
</html>
```

**Costs:**
- Supabase: $0 (free tier, 500MB database)
- Mailgun: $0 (free tier, 5,000 emails/month)
- **Total: $0/month** (until >5,000 emails or >500MB data)

**Success Criteria:**
- Users can subscribe with email
- Receives confirmation email
- Gets daily digest if new matching tournaments
- Can unsubscribe easily
- <5% bounce rate

---

### Feature 2.4: FIDE Calendar Integration ⭐ **MEDIUM-HIGH VALUE**
**Why:** 20-30% more tournament coverage
**Effort:** 20-30 hours
**Cost:** $0
**Priority:** MEDIUM

**Source:** https://calendar.fide.com/

**Implementation:** (Detailed scraper code - similar to current approach)

**Success Criteria:**
- 20-30% increase in tournament count
- Deduplication works (no double-listing)
- Data quality maintained
- Scraper runs reliably

---

## Phase 2 Success Criteria ✅

By end of Week 12, achieve:
- ✅ 500-1,000 monthly active users
- ✅ 25% returning user rate
- ✅ Calendar export working (50+ exports/month)
- ✅ Filter persistence deployed
- ✅ 50+ email alert subscribers (if implemented)
- ✅ FIDE calendar integrated (20-30% more tournaments)

---

## Phase 3: Scale & Optimize (Months 4-12)

**Goal:** Grow to 2,000-3,000 users, optimize performance
**Timeline:** 6 months
**Effort:** 100-150 hours
**Cost:** $10-50/month

### Key Features:
- Multi-language support (Spanish, French, German)
- 3rd data source (ECU or national federation)
- Performance optimizations (caching, lazy loading)
- Content marketing (blog posts, Product Hunt launch)
- Federation partnerships

---

## Budget Summary

| Phase | Duration | Hours | Cost/Month | Total Cost |
|-------|----------|-------|------------|------------|
| **Phase 1** | 4 weeks | 60-80h | $0-20 | $0-80 |
| **Phase 2** | 8 weeks | 80-120h | $0-25 | $0-200 |
| **Phase 3** | 6 months | 100-150h | $10-50 | $60-300 |
| **TOTAL (Year 1)** | 12 months | 240-350h | Avg $20 | **$60-580** |

**ROI:** Serving 2,000-3,000 users for <$600/year = **$0.20-0.30 per user**

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Low user adoption** | Focus on marketing (Reddit, chess.com), SEO optimization |
| **Scraper breaks** | Automated tests, alerts, multiple data sources |
| **Burnout** | Keep scope small, only add features users actually want |
| **Costs exceed budget** | Use free tiers, cap features at $50/month |

---

## Decision Points

### After Phase 1 (Week 4):
- **If <50 users:** Reassess marketing strategy, consider different channels
- **If 100-200 users:** Proceed with Phase 2 as planned
- **If >200 users:** Accelerate Phase 2, consider more marketing

### After Phase 2 (Week 12):
- **If <300 users:** Focus on optimization, not new features
- **If 500-1,000 users:** Proceed with Phase 3
- **If >1,000 users:** Consider monetization options (if desired)

---

## Success Definition

**Minimum Success:**
- 500+ monthly active users
- 20% returning rate
- Zero-cost operation
- Positive user feedback

**Good Success:**
- 1,500+ monthly active users
- 30% returning rate
- Featured on chess media
- 100+ email subscribers

**Exceptional Success:**
- 3,000+ monthly active users
- 40% returning rate
- Federation partnerships
- Monetization opportunities

---

## Next Steps

### Immediate (This Week):
1. ✅ Read and approve this roadmap
2. ✅ Set up Plausible Analytics account
3. ✅ Commit to Phase 1 execution
4. ✅ Schedule Reddit post for optimal time
5. ✅ Create GitHub Issues for each task

### Week 1 Execution Order:
1. Add analytics (3-4 hours)
2. SEO optimization (4-6 hours)
3. Mobile UX improvements (6-8 hours)
4. Empty state messages (2-3 hours)
5. Test everything (3-4 hours)

**Total Week 1: 18-25 hours**

**Ready to start?** 🚀

---

**END OF IMPLEMENTATION ROADMAP**
