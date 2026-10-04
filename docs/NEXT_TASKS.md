# Next Tasks (2026-09-30)

Written after cleaning up the repo on 2026-09-30. At that point there were no
open issues or PRs, and the last run of every workflow had passed. The data
counts are from `tournaments_data.json` at `d13bfbd` (1,540 tournaments).

Legend: `[x]` done · `[~]` partly done · `[ ]` not started

## P1 - Data quality (users see this)

- [~] **1. Find out why 425 tournaments (28%) have no coordinates.** They don't
  appear on the map. Geocoding is meant to fill gaps a bit more each day
  (Nominatim + GeoNames, cached), so first check whether these are stuck
  (no match, bad location text) or just waiting their turn. Add a short report
  to `geocode_tournaments.py` (reason per place, e.g. no match, rate-limited,
  not tried yet) and fix the biggest group.
  - Findings: none were waiting their turn - all had been tried. 364 were "no
    match" (a venue with no town, e.g. "Haus des Schachsports, AUT") and 60 were
    a country code only. 335 of them had a `details.address`, and that often
    includes the town ("..., 1020 Wien").
  - [x] Try the address when the location misses, and fetch details before
    geocoding (`geocoding/pipeline.py` `locate`). A trial on copies went from 425
    to 360 unplaced with 150 of the 300 daily lookups; nothing lost its
    coordinates.
  - [ ] What's left is mostly venue-only text with no address ("Schachhaus",
    "Diverse Orte in OÖ", "wird noch bekannt gegeben") or town-first addresses
    ("к.к. Боровец , Hotel IGLIKA"). Look again once a few daily runs have
    used the lookup budget.
  - [ ] The GeoNames word match picks up words that aren't towns, and those pins
    are already live (location keys, not new ones from the address fallback):
    "C/José **Miranda** Guerra (Gran Canaria)" -> Miranda de Ebro (a street
    name), "**ΛΥΚΕΙΟ** ΑΓΡΙΑΣ" -> "Lykeio" (the word for "high school"),
    "Stjepan **Polje**" -> "Polje" ("field"), "Λευκός **Πύργος**" (Thessaloniki)
    -> Pyrgos. Either skip street-prefix and generic words in
    `geonames_match`, or add overrides.
- [x] **2. "Senior School" is marked S50+.** `CHESS JUNIOR CHESS TOURNAMENT`
  (venue "KHADIJA SENIOR SCHOOL", ALB) has both `S50+` and `Youth`. Change
  `_has_senior_category` (`tournament_processing/classify.py`) so the word
  "senior" in school names and venues doesn't count, and let a youth/school
  match win. Add a Python test for it. S50+ is one of the main filters, so a
  wrong match here is very visible.
- [ ] **3. 220 tournaments have no `details`** (organizer, rounds, system).
  Same kind of question as item 1: do they fill in over time, or do they
  fail every run?

## P2 - Keeping the code healthy

- [ ] **4. Fix JS coverage showing 0%** (c8, known since #50). Until it works,
  the "coverage maintained" item on the review checklist can't be checked.
- [ ] **5. Split the files over the size limit, starting with the source files.**
  Split each one when you next work in it, then remove it from `KNOWN` and
  CLAUDE.md:
  - [ ] `TournamentProcessor.py` 506 (do this with item 2)
  - [ ] `src/services/FilterService.ts` 431
  - [ ] `src/app.ts` 424
  - [ ] `src/services/ExportService.ts` 357
  - [ ] `src/services/DataService.ts` 319
  - [ ] Tests and docs: `test_geocode.py` 420, `dark-mode-and-ui.spec.ts` 383,
    `keyboard-navigation.spec.ts` 329, `TESTING.md` 719, `ARCHITECTURE.md` 610

## P3 - Features (for the S50+ / seaside audience)

- [ ] **6. "Notify me" for a saved filter.** An RSS or iCal feed per filter
  URL (e.g. S50+ Mediterranean), generated as a static file with each scrape,
  since there's no server.
- [ ] **7. Entry fee / prize fund on cards**, if the details scrape can
  extract them reliably.

## Parked

- [ ] **Scraper Excel-download diagnostic** (saves the page state when a
  download fails). It was deleted on 2026-09-23. Only rebuild it if download
  failures come back.


## 2026-10-05 — discovery, trust, and growth follow-up

Completed in branch `improve/trust-and-source-roadmap` (open review: [PR #80](https://github.com/kobolcs/medtourney/pull/80)).

- [x] Keep the featured Seaside suggestion inside MedTourney; keep Chess-Results as an optional link in the detail panel.
- [x] Correct README positioning and state that event discovery currently depends on one provider.
- [x] Add the existing SEO-generation test to pull-request CI.

### P1 — Add source breadth safely

- [x] Verify that the search/export pipeline and event-page enrichment are both Chess-Results; data-hosting mirrors are not independent sources.
- [x] Research candidate sources. FIDE's calendar requires written permission before content is reproduced or stored. The Czech Chess Federation's event calendar is a promising country pilot, but its reuse terms and feed access are not confirmed.
- [ ] Confirm a reusable feed or written permission for one source before ingestion. No source has been contacted.
- [ ] Pilot a bounded sample and report unique eligible OTB listings, overlap, cancellations, field completeness, freshness, and correction rate.
- [ ] Preserve provider IDs, source URLs, fetched/checked dates, and conflicting-field provenance; deduplicate conservatively and keep separate event sections/tempo variants separate.
- [ ] Validate source rows individually and publish only after a reviewable diff and quality threshold pass.

### P1 — Listing trust and data operations

- [ ] Add a correction/report action for wrong dates, venues, eligibility, or time controls.
- [ ] Detect duplicates, inverted/implausible dates, cancellations, and suspicious clock classifications before publish.
- [ ] Show scrape/enrichment omissions in workflow results while retaining the last known-good snapshot.

### P2 — Product, discovery, and retention

- [ ] Clarify “events in index” versus “events matching filters” in the header/results count.
- [ ] Show event-level source and freshness in the detail panel.
- [ ] Test the full find → detail → shortlist → calendar/share journey with European OTB players on desktop and phone widths.
- [ ] Add privacy-conscious action tracking for detail opens, shortlist adds, exports, shares, and official-source clicks; establish a Search Console baseline.
- [ ] Improve the four category pages with accurate coverage/classification explanations before adding more SEO pages.
- [ ] Evaluate saved-search or followable-calendar alerts after repeat-use data supports them.

### P3 — Later

- [ ] Consider localization based on visitor and search-query data.
- [ ] Consider organizer-submitted corrections or feeds once provenance and moderation are established.

**Guardrails:** keep the product Europe-focused and static-first; event cards/category pages stay on MedTourney; do not scrape or republish where reuse permission is unclear; treat the 2,000–3,000-user goal as a target, not a forecast, until “user” and the baseline metric are defined.
