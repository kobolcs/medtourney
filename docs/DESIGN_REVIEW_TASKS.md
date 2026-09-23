# Design Review Tasks (mychess.events comparison, 2026-09-23)

Source: [MedTourney Design Review](https://claude.ai/artifact/MbEyNbY4mX1c3ESiawJ9jM).
Status checked against branch `redesign-mychess-review` on 2026-09-23.

Legend: `[x]` done · `[~]` partly done · `[ ]` not started

## Quick wins

- [x] **1. Brand name + live count in the header.** MedTourney name, live
  tournament count + last-updated line, icon-only dark-mode toggle (`67915ef`).
- [~] **2. Clean up the scraped text on each card.**
  - [x] FED code → flag + country name (`utils/countries.ts`, `formatLocation`)
  - [x] Split `category` into separate chips; colour the Classical/Rapid/Blitz pill (`67915ef`)
  - [ ] Normalise time controls: `10'05''` → `10+5`, `90'+30''` → `90+30`
    (`UIManager.condenseTimeControl()` only handles "90 min + 30 sec" style text
    today; `10'05''` passes through as-is)
  - [x] "1 days" → avoided (duration pill only shown for 2+ days)
  - [ ] Weekday span on the card ("Fri – Sun")
- [x] **3. Month dividers with per-month count** when sorted by date (`67915ef`, overflow fix `1b5591d`).
- [x] **4. Free up browser shortcuts** – single keys `/ ? d s`, active only outside inputs (`67915ef`).
- [x] **5. Filters in the URL** – shareable filtered links (`67915ef`, extracted to `utils/filterUrl.ts` in `1b5591d`).

## Weekend changes

- [~] **6. Seaside / Senior mode switch + live filtering + active-filter chips** (`65dbc07`).
  - [x] Segmented mode switch (All Europe / Seaside / Senior 50+ / Both)
  - [x] Live filtering, match count, removable chips + "Clear all"
  - [ ] Remove the Search button (the review suggested this; it's still in `index.html`)
- [x] **7. Sticky filter sidebar on desktop** (≥1024px) (`2cd6664`).
- [ ] **8. Filters in a bottom sheet on phones** – results first, a "Filters (3)" button
  opens the same filter markup as a sheet with a "Show N tournaments" button.
- [~] **9. Country list that fits the niche** (`027ecd7`).
  - [x] Grouped by region (Mediterranean, Central, Balkans & Eastern, Nordic & Baltic, British Isles)
  - [x] Type-to-filter input; empty groups hidden; "no match" message echoes the query
  - [ ] Group-level "select all" tick (deliberately skipped to limit extra Tab stops)
  - [ ] In Seaside mode, show only the Mediterranean group expanded

## Bigger additions

- [ ] **10. Map view** – geocode in `TournamentProcessor.py`, cache lat/lng in
  `tournaments_data.json`, Leaflet + OSM, clustered pins, List/Map toggle.
- [ ] **11. Travel context on cards** – nearest airport / beach town vs city,
  starting with a hand-made lookup for ~60 Mediterranean host towns.
- [x] **12. Friendlier empty state** – one-tap relaxations with real result counts,
  including "extend the date range by a month" (`a42dab7`).

## Scorecard follow-ups

- [ ] Footer shows "Data updated …" until the JSON loads (the header live line
  now covers this, but the footer placeholder is still visible at first).

## Known test issue (pre-existing, not from the review work)

- [ ] Firefox: `keyboard-navigation.spec.ts` "should navigate through filter
  collapse with Enter and Space" – focus doesn't land on the "Search Filters"
  heading after 4 Tabs. Also fails on the code before these changes.
