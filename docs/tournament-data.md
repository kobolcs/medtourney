# Tournament data and clock accuracy

Tournament content comes from chess-results.com. Numeric single clocks take precedence over informal format labels: base minutes plus 60 increments gives the FIDE comparison time (Blitz at most10 minutes, Rapid above10 and below60). Mixed formats keep their source clock text and multiple categories. Ambiguous periods retain existing source labels; eligibility and full regulations still need organizer confirmation.

Missing or unrecognized clocks use explicit name/field formats when available and otherwise appear as **Clock unconfirmed**. All tempos includes these listings; choosing a specific subset excludes them. Frontend ingestion normalizes older snapshots too, preserving other category tags. No new scrape or source freshness is claimed by this normalization.

Regression commands: `npm run test:utils:timecontrol`, `npm run test:services:filter`, and `python3 -m pytest tests/python/test_time_control_units.py tests/python/test_tournament_processor_categories.py tests/python/test_frontend_backend_parity.py --override-ini='addopts='`.

## Entry categories

Age and rating are parsed separately: U12 / Under 12 / HD12 are youth ages, while Under 1600 / Elo <1800 / Sub1800 are rating ceilings. The age picker overrides Exclude youth. Rating selections match the published ceiling exactly; they do not establish a player's eligibility. Venues do not establish entry restrictions. Senior S60+ filtering includes S65+ and older cohorts, while cards retain the exact age. Clock notation such as 60+30 is not a senior category.

`src/utils/entryCategories.ts` and `tournament_processing/entry_categories.py` share the examples in `tests/fixtures/entry-categories.json`. Ingestion repairs stale generated Youth tags on adult rating sections without claiming a new source scrape. `FilterService` delegates predicates and ordering to focused modules in `src/services/filter/`.
