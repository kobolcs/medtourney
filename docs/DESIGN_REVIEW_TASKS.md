# Design Review Tasks (mychess.events comparison, 2026-09-23)

Source: [MedTourney Design Review](https://claude.ai/artifact/MbEyNbY4mX1c3ESiawJ9jM).
Status checked against branch `redesign-mychess-review` on 2026-09-23.

Legend: `[x]` done · `[~]` partly done · `[ ]` not started

## Quick wins

- [x] **1. Brand name + live count in the header.** MedTourney name, live
  tournament count + last-updated line, icon-only dark-mode toggle (`67915ef`).
- [x] **2. Clean up the scraped text on each card.**
  - [x] FED code → flag + country name (`utils/countries.ts`, `formatLocation`)
  - [x] Split `category` into separate chips; colour the Classical/Rapid/Blitz pill (`67915ef`)
  - [x] Normalise time controls: `10'05''` → `10+5`, `90'+30''` → `90+30`
    (`utils/timeControl.ts`, `bf4d01e`; compact notations checked against chess-results pages/PDFs in `75bd4e3`)
  - [x] "1 days" → avoided (duration pill only shown for 2+ days)
  - [x] Weekday span on the card ("Fri–Sun · 3 days", single-day "Sat · 1 day";
    events over 10 days show the day count only) (`utils/durationLabel.ts`)
- [x] **3. Month dividers with per-month count** when sorted by date (`67915ef`, overflow fix `1b5591d`).
- [x] **4. Free up browser shortcuts** – single keys `/ ? d s`, active only outside inputs (`67915ef`).
- [x] **5. Filters in the URL** – shareable filtered links (`67915ef`, extracted to `utils/filterUrl.ts` in `1b5591d`).

## Weekend changes

- [x] **6. Seaside / Senior mode switch + live filtering + active-filter chips** (`65dbc07`).
  - [x] Segmented mode switch (All Europe / Seaside / Senior 50+ / Both)
  - [x] Live filtering, match count, removable chips + "Clear all"
  - [x] Remove the Search button. Desktop: gone. Below 1024px (filters above
    results) it's now "Show N tournaments ↓", jumping to the results with the
    live count; a failed data load offers its own "Try again".
  - [x] Ported the stale Robot UI suite (`test_phase2_ui.robot`, not run by CI)
    to Playwright `tests/e2e/site-basics.spec.ts` and removed it.
  - [x] Removed the "Mediterranean Seaside Only" checkbox from the primary bar -
    the mode switch is its only visible control now (hidden input kept as state).
- [x] **7. Sticky filter sidebar on desktop** (≥1024px) (`2cd6664`).
- [x] **8. Filters in a bottom sheet on phones** – results first (first card above the
  fold on a Pixel 5), a "Filters (N)" bar opens the same filter card as a sheet
  with "Show N tournaments" as its done button; the mode switch and chips stay on
  the page (`src/services/FilterSheet.ts`). Also fixed on the way: the theme
  button lost its icon after the first toggle (UIManager overwrote its content).
- [x] **9. Country list that fits the niche** (`027ecd7`).
  - [x] Grouped by region (Mediterranean, Central, Balkans & Eastern, Nordic & Baltic, British Isles)
  - [x] Type-to-filter input; empty groups hidden; "no match" message echoes the query
  - [x] Group-level "select all" tick per region (ticks shown countries; partly
    selected shows as indeterminate)
  - [x] In Seaside mode, only the Mediterranean group shows (already the case:
    regions with no seaside tournaments hide themselves)
- [x] **Seaside rule fixed** (found while checking the above): Seaside matched only
  59 of 1,617 tournaments (2 in the default view) via a 223-town list. Now also
  within 10 km of the Mediterranean or Spain/Portugal's Atlantic coast (geocoder
  `coast` flag, Natural Earth coastline) - 30 in the default view.
- [x] **Featured seaside / Beachfront** (user request): venue within 500 m of the sea
  (venue-level Nominatim hit + OSM coastline via Overpass) gets a 🏖 badge, a
  highlighted card and a ringed map pin; Tournament of the Week prefers them.

## Bigger additions

- [x] **10. Map view** - List/Map toggle, Leaflet + OpenStreetMap tiles (lazy-loaded),
  clustered pins coloured seaside/senior, "Show in list" from popups. Coordinates
  from `geocode_tournaments.py` after each daily scrape (Nominatim, cached in
  `geocode_cache.json`, GeoNames offline fallback).
- [x] **11. Travel context on cards** – nearest airport with scheduled flights and
  straight-line distance on the location line ("✈ ALC · 47 km", full name in the
  tooltip), computed after each scrape from OurAirports. "Beach town vs city" left
  out on purpose: the Seaside tag and Beachfront badge already say it.
- [x] **12. Friendlier empty state** – one-tap relaxations with real result counts,
  including "extend the date range by a month" (`a42dab7`).

## Scorecard follow-ups

- [x] Footer shows "Data updated …" until the JSON loads. Now hidden until a real
  timestamp is known (scrape time from `tournaments_data_meta.json`, or this
  browser's cache time as a first-paint fallback) - no "…" or "Never (no cached data)".

- [x] `og:image` pointed at a missing `og-image.png` (404 live) - link previews
  had no image. Added a 1200x630 card in the site's style (`public/og-image.png`,
  source `scripts/og-image.html`, render with `node scripts/render-og-image.mjs`)
  plus `og:image:width/height/alt`; the `site-basics.spec.ts` test is live.

## Known test issue (pre-existing, not from the review work)

- [x] Firefox: `keyboard-navigation.spec.ts` "should navigate through filter
  collapse with Enter and Space" – focus doesn't land on the "Search Filters"
  heading after 4 Tabs. Cause: the sticky sidebar's `overflow-y: auto` made
  `.filters-card` a Firefox Tab stop; fixed with `tabindex="-1"` (`67a3cd9`).

## Flaky tests seen

- [ ] Mobile Chrome: `exports-hardening.spec.ts:149` "calendar export on page 2
  downloads the correct tournament" failed once in a full run (2026-09-23),
  passed 3/3 on rerun.

---

# Recheck (24 Sep 2026, commit bc9f3d1)

Source: the same [Design Review artifact](https://claude.ai/artifact/MbEyNbY4mX1c3ESiawJ9jM),
republished as a recheck of merged `main`.

## Fix first (wrong, not just unpolished)

- [ ] **R1. Seaside lets in inland towns.** Tivoli matches the town list via
  "Tivoli (Rome)"; Corteconcepción was geocoded to Huelva city (province name
  at the end of the address). Only trust the coast flag when the geocode hit
  is a town or venue (not a province/region), and match the town list against
  the first place name only, not text in brackets.
- [ ] **R2. Tournament of the Week is a 7-week club championship.** Cap length
  at 5–16 days, skip club/league names (circolo, club, klub, fase, liga,
  league...), prefer Beachfront, then soonest start.
- [ ] **R3. Empty-state counts ignore the results search box.** Compute each
  relaxation with the search text applied; when the search text empties the
  list, lead with "Clear search '…' (N)".
- [ ] **R4. OS dark mode ignored.** Follow `prefers-color-scheme` unless the
  user chose a theme; apply before first paint (no light flash).

## Polish

- [ ] **P1. Show the city, not the street** in location lines (store the
  geocoded town; venue in the tooltip).
- [ ] **P2. The date appears twice** (badge + range pill + month header): drop
  the pill, put the end date under the badge.
- [ ] **P3. Tone down the card stripe**: only Seaside / Senior / Beachfront
  cards keep it; drop the "→" before the location.
- [ ] **P4. One toolbar row**: search, List/Map, Sort, ★ Shortlist, quiet
  Export menu (CSV / .ics).
- [ ] **P5. Header: one line of copy** on desktop too (long sentence to meta
  only); on phones ? and ☾ on the name's row.
- [ ] **P6. Slimmer Tournament of the Week** (it pushes the first result off a
  phone screen).
- [ ] **P7. Tablets (768–1023px)** use the bottom sheet too.
- [ ] **P8. Phone: the Filters bar covers the result count.**

## Housekeeping

- [ ] **H1. CSP blocks Vite legacy's inline scripts** (old-browser fallback can
  never load): allow them by hash or drop `@vitejs/plugin-legacy`.
- [ ] **H2. Mark the map as verified** in the artifact (rendered with real OSM
  tiles on 24 Sep).
