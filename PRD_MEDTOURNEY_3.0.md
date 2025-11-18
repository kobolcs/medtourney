# **Product Requirements Document (PRD)**
## **MedTourney 3.0 - European Chess Tournament Discovery Platform**

**Version:** 3.0 — Focused Edition
**Owner:** Product Team
**Document Type:** Focused PRD
**Status:** Approved for Development
**Strategy:** Niche Excellence over Global Ambition

---

# **Executive Summary**

MedTourney 3.0 represents a **strategic refinement** of the existing European chess tournament finder, focusing on **sustainable growth**, **realistic scope**, and **high-value features** that can be delivered by a small team with minimal costs.

**Core Philosophy:** *"Master the niche before expanding the scope"*

**Success Probability:** 55-60% (maintains high viability)
**Investment Required:** $0-50/month
**Development Timeline:** 3-6 months
**Team Size:** 1-2 developers

---

# **1. Product Vision**

To build **Europe's best chess tournament discovery tool for traveling players**, specializing in:

- 🏖️ **Mediterranean and seaside tournaments**
- 👴 **Senior category events (S50+)**
- 🎯 **Amateur and open tournaments**
- ✈️ **Vacation-friendly chess events**

**What We Are NOT Building:**
- ❌ Global platform (focus on Europe only)
- ❌ Microservices architecture (maintain static-first)
- ❌ Organizer portals (not Phase 1)
- ❌ Complex backend infrastructure
- ❌ Mobile apps (web-first is sufficient)

---

# **2. Product Goals & Success Metrics**

## **2.1 Goals**

### **Primary Goals (Must Have)**
1. ✅ Fix critical deployment issues (functional app)
2. ✅ Serve European OTB tournament seekers reliably
3. ✅ Maintain zero-cost or near-zero-cost operations
4. ✅ Grow to 1,000-3,000 active monthly users
5. ✅ Become the go-to tool for chess travelers in Europe

### **Secondary Goals (Nice to Have)**
6. 📧 Enable tournament discovery notifications
7. 📅 Provide calendar integration
8. 🌍 Add 2-3 additional data sources beyond chess-results.com
9. 🎨 Improve mobile user experience
10. 📊 Understand user behavior through analytics

## **2.2 Success Metrics (KPIs)**

### **Phase 1 (Month 1-3) - Fix & Launch**
- ✅ App is functional (tournaments_data.json populated)
- ✅ Scraper runs successfully daily
- ✅ 100+ monthly active users
- ✅ <2s page load time on mobile
- ✅ >80% successful searches (users find relevant tournaments)

### **Phase 2 (Month 4-6) - Grow & Optimize**
- 🎯 500-1,000 monthly active users
- 🎯 25% returning user rate
- 🎯 50+ tournaments meeting "Mediterranean + Senior" filter combo
- 🎯 <0.5s search response time
- 🎯 60%+ mobile traffic

### **Phase 3 (Month 7-12) - Enhance & Scale**
- 🎯 2,000-3,000 monthly active users
- 🎯 30% returning user rate
- 🎯 100+ email alert subscribers
- 🎯 2-3 data sources integrated
- 🎯 <1% error rate in tournament data

---

# **3. User Personas (Focused)**

## **3.1 Primary Personas (80% of users)**

### **P1: Chess Tourist (40%)**
**Profile:** Amateur player (1600-2000 rating) who combines chess with travel

**Needs:**
- Mediterranean seaside tournaments
- Multi-day events (align with vacation days)
- Open sections (no rating requirements)
- Easy to find hotel/venue information
- Classical time controls (main experience)

**Pain Points:**
- chess-results.com terrible on mobile
- Can't filter by "seaside + vacation-friendly"
- Hard to find adult tournaments (youth clutter)

**User Story:**
> "I want to find a chess tournament in Barcelona or the French Riviera during my summer vacation in August, where I can play classical games and enjoy the beach."

---

### **P2: Senior Tournament Player (30%)**
**Profile:** Active senior player (50-70 years old, 1800-2200 rating)

**Needs:**
- S50/S55/S60/S65 category filtering
- European tournaments (travel within Europe)
- Classical time controls (main preference)
- Clear category information
- Adult-focused events (exclude youth tournaments)

**Pain Points:**
- chess-results.com shows all categories mixed together
- No dedicated "senior-only" view
- Can't see S50+ opportunities at a glance

**User Story:**
> "I want to see all European tournaments in the next 3 months with dedicated S50+ or S60+ sections."

---

### **P3: Weekend Warrior (20%)**
**Profile:** Amateur club player (1400-1800) seeking local/regional events

**Needs:**
- Weekend tournaments only
- Open sections (accessible entry)
- Affordable entry fees
- Nearby/regional events
- Rapid or classical

**Pain Points:**
- Too much noise in search results
- Can't filter by "weekend only"
- Youth tournaments clutter results

**User Story:**
> "I want to find an open tournament within 200km of my city this month that I can play over a weekend."

---

## **3.2 Secondary Personas (20% of users)**

### **P4: Professional/Semi-Pro Player (10%)**
**Profile:** Strong player (2200+) seeking competitive events

**Needs:**
- Strong open tournaments
- Norm opportunities (GM/IM)
- Prize fund information
- International field strength

---

### **P5: Women/Girls Player (10%)**
**Profile:** Female player seeking women-only or girls-only sections

**Needs:**
- Women-only filters
- Girls categories (U8-U18)
- Combined women + open events

---

# **4. Competitive Positioning**

## **4.1 Competitive Landscape**

| Platform | Scope | Strengths | Weaknesses | Our Position |
|----------|-------|-----------|------------|--------------|
| **chess-results.com** | Global | Comprehensive data | Terrible UX, no mobile | **Complement with better UX** |
| **FIDE Calendar** | Global | Official | Poor search, incomplete | **Integrate as 2nd source** |
| **National Federations** | Regional | Authoritative | Fragmented | **Aggregate selectively** |
| **chess.com/events** | Global | Modern UI | Focus on online | **Different focus (OTB)** |
| **lichess.org** | Global | Great UX | Online only | **Different category** |

## **4.2 Our Competitive Advantages**

✅ **Specialized Niche:** Only tool focused on European traveling chess players
✅ **Advanced Filtering:** Mediterranean + Senior + Open combinations
✅ **Zero Friction:** No accounts, no ads, no tracking
✅ **Mobile-First:** Actually usable on phones (chess-results.com isn't)
✅ **Free & Sustainable:** Zero-cost model allows long-term commitment
✅ **Open Source:** Community can contribute and trust transparency

## **4.3 Differentiation Strategy**

**We are NOT trying to replace chess-results.com**
**We are providing a better filtered view FOR travelers and seniors**

**Positioning Statement:**
> "MedTourney is the specialized European tournament finder for chess players who combine travel with competitive play, with unique filters for Mediterranean locations, senior categories, and vacation-friendly events."

---

# **5. Core Features (Prioritized)**

## **5.1 Phase 1: Fix & Launch (Month 1-3)**

### **CRITICAL - Must Fix Immediately**

#### **F1.1: Deploy Tournament Data** 🔴 **CRITICAL**
**Problem:** tournaments_data.json is empty (2 bytes) - app is non-functional
**Solution:** Run scraper successfully and commit populated JSON file
**Success Criteria:** JSON file contains 50+ tournaments
**Effort:** 4-8 hours

---

#### **F1.2: Verify Daily Scraper** 🔴 **CRITICAL**
**Problem:** Need to verify GitHub Actions workflow runs successfully
**Solution:** Test scraper manually, verify GitHub Actions, check logs
**Success Criteria:** Scraper runs daily at 00:00 UTC without errors
**Effort:** 4-8 hours

---

### **HIGH PRIORITY - Quick Wins**

#### **F1.3: Add Privacy-Friendly Analytics** ⚠️ **HIGH**
**Why:** Cannot improve what you don't measure
**Solution:** Implement Plausible Analytics or Simple Analytics (GDPR-friendly)
**Metrics to Track:**
- Page views, unique visitors
- Search queries (anonymized)
- Filter usage patterns
- Mobile vs. desktop
- Geographic distribution

**Implementation:** Add script tag, no backend needed
**Cost:** $0 (self-hosted) or $9/month (Plausible)
**Effort:** 2-4 hours

---

#### **F1.4: SEO Optimization** ⚠️ **HIGH**
**Why:** Users can't find what they can't discover
**Changes Needed:**
- Meta tags (title, description, keywords)
- Open Graph tags (social sharing)
- Schema.org markup (Event schema)
- Sitemap.xml generation
- robots.txt

**Example Meta Tags:**
```html
<title>MedTourney - European Chess Tournament Finder | Mediterranean & Senior Events</title>
<meta name="description" content="Find European chess tournaments with advanced filters for Mediterranean locations, senior categories (S50+), and vacation-friendly events. Free tournament search tool.">
<meta property="og:title" content="MedTourney - European Chess Tournament Finder">
<meta property="og:image" content="https://kobolcs.github.io/medtourney/og-image.png">
```

**Effort:** 4-8 hours
**Impact:** Enables organic search traffic

---

#### **F1.5: Improve Mobile UX** ⚠️ **HIGH**
**Why:** 50%+ users will be on mobile
**Changes:**
- Increase touch targets to 48×48px minimum
- Fix horizontal scrolling on <320px screens
- Improve filter drawer UX
- Add "sticky search" button
- Optimize pagination controls

**Effort:** 8-12 hours

---

#### **F1.6: Add Empty State Messaging** ⚠️ **MEDIUM**
**Why:** Better UX when no tournaments match filters
**Current:** "No tournaments found" (confusing)
**Improved:**
```
📅 No tournaments match your filters

Try:
• Expanding your date range
• Removing some filters
• Checking different countries

Tournament data updates daily at 00:00 UTC.
Last update: 2025-11-18 00:05 UTC
```

**Effort:** 2-4 hours

---

## **5.2 Phase 2: Enhance & Grow (Month 4-6)**

### **F2.1: Calendar Export (.ics files)** ⚠️ **HIGH VALUE**
**Why:** Easy to implement, high user value
**Feature:** Download selected tournaments as .ics calendar file
**Technical:** Generate ICS format client-side (no backend needed)
**Use Case:** User finds 5 tournaments, exports to Google Calendar
**Effort:** 8-12 hours
**Cost:** $0

```typescript
// Example implementation
function exportToCalendar(tournament: Tournament): string {
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${tournament.name}
DTSTART:${tournament.startDate}
DTEND:${tournament.endDate}
LOCATION:${tournament.location}
DESCRIPTION:${tournament.url}
END:VEVENT
END:VCALENDAR`;
}
```

---

### **F2.2: Filter Persistence (localStorage)** ⚠️ **MEDIUM**
**Why:** Users shouldn't re-set filters every visit
**Feature:** Save filter state to browser localStorage
**Technical:** Store filter object in localStorage on change
**Effort:** 4-8 hours
**Cost:** $0

---

### **F2.3: Email Alerts (Lightweight)** ⚠️ **MEDIUM**
**Why:** High user value for tournament discovery
**Architecture:** Use free email service (Mailgun 5,000/month free)
**Flow:**
1. User saves search filters
2. Daily cron checks for new tournaments matching filters
3. Sends email digest

**Constraints:**
- Simple implementation (no complex backend)
- Use GitHub Actions for cron
- Store subscriptions in simple JSON file or Supabase free tier

**Effort:** 16-24 hours
**Cost:** $0-10/month

---

### **F2.4: Add FIDE Calendar as 2nd Data Source** ⚠️ **MEDIUM**
**Why:** Increase tournament coverage by 20-30%
**Source:** https://calendar.fide.com/
**Technical:**
- New scraper for FIDE calendar
- Data normalization to match schema
- Deduplication logic

**Effort:** 20-30 hours
**Risk:** FIDE may block scraping (need to test)

---

### **F2.5: "Share Tournament" Feature** ⚠️ **LOW**
**Why:** Enables word-of-mouth growth
**Feature:** Share button generates sharable link
**Implementation:**
- URL with query params (e.g., `?t=barcelona-open-2025`)
- Copy to clipboard button
- Social share buttons (WhatsApp, Facebook, Twitter)

**Effort:** 4-8 hours

---

## **5.3 Phase 3: Scale & Optimize (Month 7-12)**

### **F3.1: Add 1-2 More Data Sources**
**Candidates:**
- ECU (European Chess Union) calendar
- Major national federations (Germany DSB, France FFE, Spain FEDA)
- Select club calendars

**Criteria:** Only add if:
- Legal to scrape
- Data quality is good
- Adds meaningful new tournaments (not duplicates)

**Effort:** 15-25 hours per source

---

### **F3.2: Performance Optimization**
**Issues:**
- Filter caching (memoization)
- Lazy loading for large datasets
- Service Worker for offline support
- Image optimization

**Effort:** 16-24 hours

---

### **F3.3: Multi-Language Support (EU Languages)**
**Languages:** English (default), Spanish, French, German
**Scope:** UI only (tournament data stays original)
**Technical:** i18n library (i18next)
**Effort:** 20-30 hours

---

# **6. Technical Architecture (v3.0)**

## **6.1 Architecture Principles**

1. ✅ **Static-First:** Maintain GitHub Pages hosting (zero cost)
2. ✅ **Progressive Enhancement:** Add features without breaking core
3. ✅ **Minimize Backend:** Use serverless/free tiers when needed
4. ✅ **Open Source:** All code remains public and auditable
5. ✅ **Privacy-First:** No user tracking, minimal data collection

## **6.2 Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  chess-results.com ──→ Robot Framework Scraper (GitHub       │
│  FIDE Calendar ──────→  Actions)                             │
│  [Future: Federations] ↓                                     │
│                   TournamentProcessor.py                     │
│                          ↓                                    │
│                   tournaments_data.json                      │
│                          ↓                                    │
│                   GitHub Pages (CDN)                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND LAYER (Static)                      │
├─────────────────────────────────────────────────────────────┤
│  TypeScript (app.ts) → Compiled to app.js                   │
│  HTML5 + CSS3 (Mobile-First)                                │
│  LocalStorage (filter persistence)                          │
│  Service Worker (offline, Phase 3)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              OPTIONAL BACKEND (Phase 2+)                     │
├─────────────────────────────────────────────────────────────┤
│  Email Alerts: GitHub Actions + Mailgun (free tier)         │
│  User Prefs: Supabase (free tier, 500MB)                    │
│  Analytics: Plausible (self-hosted or $9/mo)                │
└─────────────────────────────────────────────────────────────┘
```

## **6.3 Technology Stack (Unchanged)**

**Frontend:**
- TypeScript 5.3+ (strict mode)
- Vanilla JavaScript (no framework overhead)
- HTML5 + CSS3 (responsive)
- ESLint + MyPy (quality)

**Backend/Processing:**
- Python 3.11+
- Robot Framework (scraping)
- Playwright (browser automation)
- pytest (testing)

**Infrastructure:**
- GitHub Pages (hosting) - $0
- GitHub Actions (CI/CD, scraping) - $0
- Optional: Supabase (user data) - $0-25/month
- Optional: Mailgun (email) - $0-10/month

**Total Costs:** $0-50/month (vs. $500-5,000/month for global platform)

---

# **7. Data Schema (Refined)**

## **7.1 Tournament Object (Core)**

```typescript
interface Tournament {
  // Identity
  id: string;                    // Unique ID (hash of name+date+location)
  source: 'chess-results' | 'fide' | 'federation';
  sourceUrl: string;             // Original tournament page

  // Basic Info
  name: string;
  organizer?: string;

  // Time
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  registrationDeadline?: string;

  // Location
  country: string;               // Full name (e.g., "Spain")
  city: string;
  venue?: string;

  // Location Tags (our special sauce!)
  locationTags: {
    mediterranean: boolean;      // Mediterranean seaside
    seaside: boolean;            // Any seaside
    island: boolean;             // Island location
    resort: boolean;             // Resort/vacation destination
  };

  // Tournament Details
  format: 'Swiss' | 'Round-robin' | 'Knockout' | 'Team' | 'Other';
  timeControl: 'Classical' | 'Rapid' | 'Blitz' | 'Mixed';
  timeControlDetails?: string;   // e.g., "90+30"

  // Categories (key feature!)
  categories: {
    open: boolean;
    amateur: boolean;
    senior: boolean;             // Any senior category
    seniorCategories: string[];  // ['S50', 'S60', 'S65']
    women: boolean;
    youth: boolean;
    youthOnly: boolean;          // Exclude if true
  };

  // Financial
  entryFee?: string;
  prizeFund?: string;

  // Additional
  description?: string;
  website?: string;
  contact?: string;

  // Metadata
  lastUpdated: string;           // ISO timestamp
  dataQuality: 'verified' | 'auto' | 'unverified';
}
```

## **7.2 Deduplication Logic**

**Problem:** FIDE and chess-results.com may list same tournament

**Solution:**
```typescript
function generateTournamentId(tournament: Tournament): string {
  const normalized = `${tournament.name.toLowerCase().trim()}-${tournament.startDate}-${tournament.city.toLowerCase()}`;
  return hashString(normalized); // SHA-256 hash
}

function isDuplicate(t1: Tournament, t2: Tournament): boolean {
  // Same ID = duplicate
  if (t1.id === t2.id) return true;

  // Fuzzy matching for name + date + location
  const nameMatch = similarityScore(t1.name, t2.name) > 0.85;
  const dateMatch = t1.startDate === t2.startDate;
  const locationMatch = t1.city === t2.city;

  return nameMatch && dateMatch && locationMatch;
}
```

---

# **8. User Experience (UX) Requirements**

## **8.1 Mobile-First Design**

**Breakpoints:**
- Mobile: 320px - 768px (primary)
- Desktop: 769px+ (secondary)

**Mobile Optimizations:**
- ✅ Touch targets ≥48×48px
- ✅ Single-column layout
- ✅ Slide-up filter drawer
- ✅ Sticky search button
- ✅ Lazy load results (pagination)

## **8.2 Performance Targets**

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **First Contentful Paint (FCP)** | <1.5s | ~1.0s | ✅ |
| **Time to Interactive (TTI)** | <3.0s | ~2.0s | ✅ |
| **Search Response** | <0.5s | ~0.2s | ✅ |
| **Lighthouse Score (Mobile)** | >90 | ~85 | ⚠️ |

## **8.3 Key User Flows**

### **Flow 1: Quick Search (Most Common)**
1. User lands on homepage
2. Clicks "Search Tournaments" (defaults applied)
3. Sees results (50-200 tournaments)
4. Applies 1-2 filters (country, senior category)
5. Finds tournament
6. Clicks to chess-results.com for registration

**Target Time:** <30 seconds

---

### **Flow 2: Specific Search (Power User)**
1. User lands on homepage
2. Sets custom date range
3. Selects country (e.g., Spain)
4. Enables "Mediterranean" filter
5. Enables "S50+" filter
6. Clicks search
7. Sees 5-15 highly relevant results
8. Exports to calendar or bookmarks tournament

**Target Time:** <60 seconds

---

### **Flow 3: Browsing (Discovery)**
1. User lands on homepage
2. Browses "Featured Tournaments" (if we add)
3. Or starts with minimal filters
4. Pages through results
5. Discovers new tournament location

**Target Time:** 2-5 minutes

---

# **9. Marketing & Growth Strategy**

## **9.1 Distribution Channels**

### **Phase 1: Initial Launch (Month 1)**

**Target:** 100-200 users

1. **Reddit** (/r/chess - 500K members)
   - Post: "I built a better way to find European chess tournaments [Free Tool]"
   - Focus on pain points (chess-results.com UX)
   - Share unique features (Mediterranean filter, mobile-friendly)

2. **Chess.com Forums** (1M+ users)
   - Community → General Discussion
   - Post in regional forums (Europe, Spain, etc.)

3. **Facebook Groups**
   - European Chess Players
   - National chess groups (Spain, France, Germany)
   - Senior chess players groups

4. **Twitter/X**
   - Chess hashtags (#chess, #chessnews, #chessdotcom)
   - Tag chess influencers (GothamChess, Levy Rozman, etc.)

---

### **Phase 2: Organic Growth (Month 2-6)**

**Target:** 500-1,000 users

5. **SEO** (organic search traffic)
   - Target keywords: "european chess tournaments", "mediterranean chess", "senior chess tournaments"
   - Blog posts (if adding content):
     - "10 Best Mediterranean Chess Tournaments in 2025"
     - "Guide to Senior Chess Tournaments in Europe"

6. **Word of Mouth**
   - Add "Share" functionality
   - Encourage users to share with club members

7. **Chess Club Partnerships**
   - Reach out to 20-30 major European clubs
   - Ask them to link from their websites
   - Offer to list their tournaments prominently

---

### **Phase 3: Scale (Month 7-12)**

**Target:** 2,000-3,000 users

8. **Content Marketing**
   - YouTube video demo
   - Blog content on tournament travel
   - Guest posts on chess blogs

9. **Federation Partnerships**
   - Approach national federations
   - Offer free integration of their calendars
   - Get backlinks from official sites

10. **Product Hunt Launch**
    - Launch on Product Hunt
    - Target: #1-5 Product of the Day in Sports category

---

## **9.2 Messaging & Positioning**

**Tagline:** "Find Your Next Chess Adventure"

**Value Propositions:**
1. 🏖️ "The only tournament finder with Mediterranean and seaside filters"
2. 👴 "Specialized senior category search (S50, S60, S65+)"
3. 📱 "Actually works on mobile (unlike chess-results.com)"
4. 🆓 "100% free, no ads, no tracking"
5. ⚡ "Lightning-fast search and filtering"

**Target Message by Persona:**

**Chess Tourist:**
> "Planning a chess vacation? Find tournaments in Barcelona, Nice, Athens, and other Mediterranean destinations in seconds."

**Senior Player:**
> "See all European S50+ and S60+ tournaments at a glance. No more hunting through mixed results."

**Weekend Warrior:**
> "Filter out youth tournaments and find open sections near you. Mobile-friendly search."

---

# **10. Analytics & Metrics**

## **10.1 Key Metrics to Track**

### **Usage Metrics**
- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- Session duration
- Pages per session
- Bounce rate

### **Feature Metrics**
- Search frequency
- Filter usage (which filters are most popular?)
- Click-through rate to chess-results.com
- Calendar export usage
- Email alert subscriptions

### **Acquisition Metrics**
- Traffic sources (organic, direct, referral, social)
- Geographic distribution
- Device breakdown (mobile vs desktop)

### **Quality Metrics**
- Search success rate (% of searches finding >0 results)
- Zero-result searches (need better data or UX)
- Error rates
- Scraper uptime

## **10.2 Analytics Tool**

**Recommendation:** Plausible Analytics

**Why:**
- ✅ Privacy-friendly (GDPR compliant)
- ✅ No cookies, no tracking
- ✅ Simple, clean interface
- ✅ Lightweight (<1KB script)
- ✅ Can self-host (free) or use cloud ($9/month)

**Alternative:** Simple Analytics ($19/month but similar benefits)

---

# **11. Success Criteria & Milestones**

## **11.1 Phase 1: Fix & Launch (Month 1-3)**

### **Week 1: Critical Fixes**
- ✅ tournaments_data.json deployed and populated
- ✅ Scraper verified working
- ✅ App is functional end-to-end

### **Month 1: Launch Ready**
- ✅ SEO optimizations complete
- ✅ Mobile UX improvements deployed
- ✅ Analytics installed
- ✅ Marketing posts on Reddit + chess.com
- 🎯 **Target: 100+ MAU**

### **Month 2-3: Iterate**
- ✅ User feedback collected
- ✅ Bug fixes deployed
- ✅ Performance optimizations
- 🎯 **Target: 300-500 MAU**

---

## **11.2 Phase 2: Enhance & Grow (Month 4-6)**

### **Month 4: High-Value Features**
- ✅ Calendar export (.ics) launched
- ✅ Filter persistence working
- ✅ Email alerts (beta) for early users

### **Month 5: Data Expansion**
- ✅ FIDE calendar integrated (2nd source)
- ✅ Deduplication working
- ✅ 20-30% more tournaments in database

### **Month 6: Optimization**
- ✅ Performance improvements
- ✅ Mobile UX refined based on analytics
- 🎯 **Target: 1,000+ MAU**

---

## **11.3 Phase 3: Scale (Month 7-12)**

### **Month 7-9: Feature Polish**
- ✅ Multi-language support (Spanish, French, German)
- ✅ 3rd data source added (federation or ECU)
- ✅ Advanced filters based on user requests

### **Month 10-12: Growth Push**
- ✅ Product Hunt launch
- ✅ Federation partnerships established
- ✅ Content marketing strategy deployed
- 🎯 **Target: 2,000-3,000 MAU**

---

# **12. Risk Management**

## **12.1 Technical Risks**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **chess-results.com blocks scraping** | Medium | High | Add User-Agent rotation, rate limiting, backup data sources |
| **Scraper breaks due to HTML changes** | High | Medium | Automated tests, alerts on failure, version control |
| **GitHub Pages outage** | Low | Medium | Can migrate to Netlify/Vercel in 1 hour |
| **Data quality issues** | Medium | Medium | Validation rules, manual review of new sources |

---

## **12.2 Market Risks**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Low user adoption** | Medium | High | Focus on marketing, improve SEO, Reddit presence |
| **chess.com launches similar feature** | Low | High | Differentiate with niche focus (Mediterranean, seniors) |
| **User expectations exceed scope** | Medium | Low | Clear messaging about scope, manage expectations |

---

## **12.3 Operational Risks**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Maintainer burnout** | Medium | High | Keep scope small, automate everything possible, recruit co-maintainer |
| **Cost increases** | Low | Low | Use free tiers, monitor usage, have $50/month budget cap |
| **Legal issues (scraping)** | Low | Medium | Only scrape public data, have opt-out mechanism, consult lawyer if needed |

---

# **13. Budget & Resources**

## **13.1 Cost Structure**

### **Phase 1 (Month 1-3): $0/month**
- GitHub Pages: Free
- GitHub Actions: Free (2,000 min/month)
- Domain: Free (github.io)
- **Total: $0/month**

### **Phase 2 (Month 4-6): $0-25/month**
- Analytics (Plausible): $0 (self-hosted) or $9/month
- Email (Mailgun): $0 (free tier 5,000/month)
- User data (Supabase): $0 (free tier 500MB)
- **Total: $0-9/month**

### **Phase 3 (Month 7-12): $10-50/month**
- Analytics: $9/month
- Email: $10/month (paid tier for 10,000 emails)
- Database: $0-25/month (Supabase if >500MB)
- CDN/Performance: $0 (GitHub Pages sufficient)
- **Total: $19-44/month**

**Annual Cost Estimate: $100-500/year** (vs. $6,000-60,000/year for global platform)

---

## **13.2 Time Investment**

### **Phase 1: 60-100 hours**
- Critical fixes: 8-16 hours
- SEO + Mobile UX: 12-20 hours
- Marketing + launch: 20-30 hours
- Testing + iteration: 20-30 hours

### **Phase 2: 80-120 hours**
- Calendar export: 8-12 hours
- Email alerts: 16-24 hours
- FIDE integration: 20-30 hours
- Filter persistence: 4-8 hours
- Testing + refinement: 32-46 hours

### **Phase 3: 100-150 hours**
- Multi-language: 20-30 hours
- 3rd data source: 20-30 hours
- Performance optimization: 16-24 hours
- Advanced features: 24-36 hours
- Content marketing: 20-30 hours

**Total Year 1: 240-370 hours** (~5-7 hours/week average)

---

# **14. Open Questions & Decisions Needed**

## **14.1 Immediate Decisions (Week 1)**

1. **Analytics Tool:** Self-hosted Plausible (free) or cloud ($9/month)?
   - **Recommendation:** Start with cloud ($9) for simplicity

2. **Domain:** Keep github.io or buy custom domain?
   - **Recommendation:** Keep github.io for now, buy medtourney.com later ($12/year)

3. **Priority Order:** SEO first or Mobile UX first?
   - **Recommendation:** Mobile UX first (affects current users immediately)

---

## **14.2 Phase 2 Decisions (Month 3)**

4. **Email Alerts:** Build custom or use service like Buttondown?
   - **Decision needed:** Evaluate after Phase 1 user feedback

5. **FIDE Integration:** Worth the effort? Or focus on chess-results.com quality?
   - **Decision needed:** Test FIDE scraping feasibility first

6. **User Accounts:** Needed for alerts or just use email subscriptions?
   - **Recommendation:** Email-only (no accounts) for Phase 2

---

# **15. Success Definition**

## **What Does Success Look Like?**

### **Minimum Success (Year 1):**
- ✅ 500-1,000 monthly active users
- ✅ 20% returning user rate
- ✅ Tool is used and appreciated by niche community
- ✅ Zero or near-zero costs (sustainable forever)
- ✅ 10+ GitHub stars
- ✅ Positive Reddit/chess.com feedback

### **Good Success (Year 1):**
- ✅ 1,500-2,500 monthly active users
- ✅ 30% returning user rate
- ✅ Mentioned on chess podcasts or YouTube channels
- ✅ 50+ GitHub stars
- ✅ 100+ email alert subscribers
- ✅ Organizers start reaching out to list tournaments

### **Exceptional Success (Year 1):**
- ✅ 3,000-5,000 monthly active users
- ✅ 40% returning user rate
- ✅ Federation partnerships established
- ✅ 200+ GitHub stars
- ✅ Featured on chess.com or major chess media
- ✅ Monetization opportunities (if desired)

---

# **16. Conclusion**

MedTourney 3.0 represents a **strategic focus on sustainable niche excellence** rather than unsustainable global ambition.

**Core Principles:**
1. ✅ **Niche Excellence:** Best European tournament finder for travelers
2. ✅ **Realistic Scope:** Achievable by 1-2 person team
3. ✅ **Zero/Low Cost:** Sustainable indefinitely
4. ✅ **High Quality:** Focus on UX, performance, mobile
5. ✅ **User-Centric:** Build for real users, not vanity metrics

**Success Probability: 55-60%** (vs. 18% for global platform)

**The Path Forward:**
1. Fix critical issues (Week 1)
2. Launch and market (Month 1-3)
3. Enhance with high-value features (Month 4-6)
4. Scale sustainably (Month 7-12)

**Remember:** *"A successful niche tool serving 2,000 passionate users is worth 10x more than a failed ambitious platform serving zero."*

---

**Approved for Development:** ✅
**Next Step:** Create detailed implementation roadmap and start Phase 1

---

## **Appendix A: Comparison to Global Platform PRD**

| Dimension | Global Platform (Rejected) | MedTourney 3.0 (Approved) |
|-----------|---------------------------|--------------------------|
| **Scope** | Global (all tournaments) | European (niche focus) |
| **Data Sources** | 15+ sources | 2-3 sources |
| **Architecture** | Microservices | Static-first |
| **Team** | 5 FTE needed | 1-2 developers |
| **Cost** | $50-150K/year | $100-500/year |
| **Time** | 12-24 months | 3-6 months (MVP) |
| **Success Probability** | 18% | 55-60% |
| **Complexity** | 20-30x current | 2-3x current |
| **Sustainability** | Requires funding | Self-sustainable |

**Decision: Proceed with MedTourney 3.0** ✅

---

**END OF PRD - MedTourney 3.0**
