"""TournamentProcessor mixin: Classical / Rapid / Blitz from the time-control field (FIDE 60-move formula) or the name."""

import re

from tournament_processing.base import ProcessorBase
from tournament_processing.entry_categories import (
    is_youth,
    rating_ceilings,
    senior_ages,
    youth_ages,
)


class TimeControlMixin(ProcessorBase):
    """Classical / Rapid / Blitz from the time-control field (FIDE 60-move formula) or the name."""

    def _total_to_class(self, total: int) -> str:
        """Map a total-minutes value to Blitz / Rapid / Classical."""
        if total <= self._BLITZ_MAX_MINUTES:
            return "Blitz"
        if total < self._RAPID_MAX_MINUTES:
            return "Rapid"
        return "Classical"

    def _classify_by_fide_formula(self, tc_lower: str) -> str | None:
        """Classify time control using the official FIDE 60-move formula.

        FIDE formula: total = base_minutes + increment_seconds
        (60 moves x inc_sec / 60 sec = inc_sec minutes contribution)
        Blitz: <= 10 min; Rapid: 10 < total < 60; Classical: >= 60.
        """
        tc_lower = self._normalise_units(tc_lower)

        # "2x15" / "2 x 15 + 5": 15 minutes per player (the "2x" is the
        # two clocks, not a multiplier on the game length). Unrecognised
        # before 2026-09-26, so these kids' 15-minute events fell through
        # to the "Classical" default.
        per_player = re.match(r"^\s*2\s*[x×]\s*", tc_lower)  # noqa: RUF001 (the multiplication sign is real data)
        if per_player:
            tc_lower = tc_lower[per_player.end():]
            m = re.match(r"^(\d+)[\s.]*(?:min\w*)?[\s.]*(?:/\s*[^\d\s]\S*)?\s*$", tc_lower)
            if m:  # just "2x15" / "2x15. min. / hráče": no increment
                return self._total_to_class(int(m.group(1)))

        # N+M bare format: "8+3", "90+30", "10+5'" etc.
        m = re.search(r"(\d+)\s*\+\s*(\d+)", tc_lower)
        if m:
            return self._total_to_class(int(m.group(1)) + int(m.group(2)))

        # Bare "N/M" (e.g. "15/5", "3/2") - some UK clubs use a slash instead
        # of "+" for base/increment. Anchored to the WHOLE string, not
        # searched as a substring: "/" is also used for moves-count formats
        # like "40/90 Min, Rest 15 Min" (40 moves per 90 min, not 40+90) or
        # "90/40 + 30 sec/incr.", which always carry extra text around the
        # slash - only a string that is *just* two numbers and a slash means
        # base+increment.
        m = re.match(r"^(\d+)\s*/\s*(\d+)$", tc_lower.strip())
        if m:
            return self._total_to_class(int(m.group(1)) + int(m.group(2)))

        # Equal hyphen clocks give minutes per player (Hungarian "10-10").
        # Preserve the existing base/increment interpretation for unequal pairs.
        # Not searched as a substring - hyphens appear in date ranges and
        # multi-session formats ("40-20") where the hyphen is a separator
        # between control periods, not base+increment.
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", tc_lower.strip())
        if m:
            increment = 0 if m.group(1) == m.group(2) else int(m.group(2))
            return self._total_to_class(int(m.group(1)) + increment)

        # "N unit [... M sec-unit]" format: "10min plus 3sec", "90 minutes + 30
        # seconds", "45 minutes with 15 second increment", "30 minutes for
        # game with 30 seconds increment", "... with an increment of 10
        # seconds ...", "10' + 2''" (prime = minutes, double prime = seconds -
        # chess-results.com's own compact notation, also "10'05''" with no
        # separator at all). The connector between base and increment varies
        # too much across organizers/languages/notations to enumerate, so
        # just take the first "<number><seconds-marker>" found anywhere after
        # the base time instead of requiring a specific connector before it.
        # Deliberately NOT anchored with \b: real data spells "minutes" and
        # "seconds" in a dozen languages ("Minuten", "minutos", "minut",
        # "minuter", "minūtes", ...), all matched here only via their shared
        # "min"/"sec" prefix. \b after that prefix breaks every one of them,
        # since none happen to end a word right there (confirmed against the
        # full real dataset - adding it misclassified 128 entries). This
        # does mean a contrived string like "5 sections, 30 sec increment"
        # could match "sec" inside "sections" first; not worth the tradeoff
        # for a pattern that doesn't occur anywhere in real time-control
        # data (that field describes clock settings, not tournament
        # structure) versus breaking every non-English tournament's clock.
        # Also accept a backtick alongside the apostrophe/prime mark: some
        # sources' apostrophes come through as a backtick, e.g.
        # "8`+ 3\" por mov" - a real example that was otherwise unrecognized
        # entirely and fell through to the "Classical" default despite
        # being an 8+3=11 (Rapid) game.
        # Allow an optional dot between the digit and the unit marker so that
        # dotted abbreviations like "10.min.+ 5.sek." are handled correctly.
        # Also adds U+00B4 ACUTE ACCENT alongside the apostrophe/prime
        # family so that "5[acute] + 3[quote]" (chess-results compact notation) classifies
        # as Blitz instead of falling through to Classical.
        m = re.search(r"(\d+)[\s.]*(h(?:our)?s?|min(?:ute)?s?|['′`´])", tc_lower)  # noqa: RUF001 (deliberate: matches real prime-mark/acute notation)
        if m:
            val = int(m.group(1))
            base = val * 60 if m.group(2).startswith("h") else val
            m2 = re.search(
                r"(\d+)[\s.]*(?:s(?:ec|ek|eg|ekunde|econds?|ekundy)?|['′`´]{2}|[\"″])",  # noqa: RUF001 (deliberate: double-prime/acute seconds notation)
                tc_lower[m.end():]
            )
            inc = int(m2.group(1)) if m2 else 0
            return self._total_to_class(base + inc)

        return None

    # Minute / second units in other languages and scripts, and a bare "m",
    # mapped onto "min" / "sec" before the formula runs, as of 2026-09-26.
    # Without this, "5мин+5 сек" and "10 m + 5 s" matched nothing and were
    # published as "Classical". Mirrors BASE_RE / INC_RE in the frontend's
    # src/utils/timeControl.ts.
    _MINUTE_UNIT_RE = re.compile(r"(\d)\s*(?:мин\w*|хв\w*|perc\w*|dəq\w*|λεπτ\w*|m(?![a-zа-я]))")  # noqa: RUF001 (Cyrillic units are real data)
    _SECOND_UNIT_RE = re.compile(r"(\d)\s*(?:сек\w*|δευτ\w*|san\w*|mp\b)")

    def _normalise_units(self, tc_lower: str) -> str:
        """Rewrite non-English / abbreviated minute and second units as "min" / "sec"."""
        spanish_minutes = {"cinco": "5", "seis": "6", "siete": "7", "ocho": "8"}
        tc_lower = re.sub(
            r"\b(cinco|seis|siete|ocho)(?=\s+minutos?\b)",
            lambda m: spanish_minutes[m.group(1)], tc_lower,
        )
        tc_lower = self._MINUTE_UNIT_RE.sub(r"\1min", tc_lower)
        return self._SECOND_UNIT_RE.sub(r"\1sec", tc_lower)

    def _classify_mixed_clocks(self, tc_lower: str) -> str | None:
        """Separate explicitly delimited event clocks, not comma-separated periods."""
        parts = re.split(
            r"\s*[;|\n]\s*|\s+/\s+|\s+and\s+|\s+(?=(?:blitz|rapid|classical|standard)\s*:?\s*\d)",
            tc_lower,
        )
        if len(parts) <= 1:
            return None
        labelled = all(self._explicit_time_classes(part) for part in parts)
        compact = all(re.fullmatch(r"\d+\s*\+\s*\d+", part.strip()) for part in parts)
        separator = re.search(r"\s+/\s+|\s+and\s+|\|", tc_lower)
        if not labelled and not (compact and separator):
            return None
        classes = [self._classify_time_control_field(part) for part in parts]
        return ", ".join(dict.fromkeys(value for value in classes if value))

    @staticmethod
    def _explicit_time_classes(tc_lower: str) -> list[str]:
        """Keep every stated format when no single numeric clock resolves it."""
        return [label for keyword, label in [
            ("blitz", "Blitz"), ("rapid", "Rapid"), ("classical", "Classical"),
            ("standard", "Classical"),
        ] if keyword in tc_lower]

    def _classify_time_control_field(self, time_control: str) -> str | None:
        """Prefer a recognised numeric clock; preserve independent mixed formats."""
        if not time_control:
            return None
        tc_lower = time_control.lower()
        mixed = self._classify_mixed_clocks(tc_lower)
        if mixed:
            return mixed
        classes = self._explicit_time_classes(tc_lower)
        # A move-count or additional period is not a verified single clock.
        # Retain its explicit source label rather than guessing a new category.
        periods = re.search(r"\b40\s*/|/\s*40\b|\b40\s+moves|\brest\b", tc_lower)
        if classes and (periods or len(re.findall(r"\d+\s*\+\s*\d+", tc_lower)) > 1):
            return ", ".join(dict.fromkeys(classes))
        clock_text = re.sub(r"^(?:rapid|blitz|classical|standard)\s*:?\s*(?=\d)", "", tc_lower)
        numeric = self._classify_by_fide_formula(clock_text)
        if numeric:
            return numeric
        return ", ".join(dict.fromkeys(classes)) if classes else None

    def _determine_category(self, name: str, _location: str, time_control: str) -> str:
        """Determine tournament category from time control and name."""
        time_classes = {"Classical", "Rapid", "Blitz", "Unknown"}
        category_parts: list[str] = []

        tc_class = self._classify_time_control_field(time_control)

        if tc_class:
            category_parts.append(tc_class)

        # Extract format labels from name; skip time-class labels when
        # tc_class is already known. This is deliberately only a fallback
        # for when the time-control field gave nothing at all (empty or
        # unparseable) - NOT an override of a value the field successfully
        # produced. Tried making the name's own "rapid"/"blitz" override a
        # formula result and reverted it: several real listings are
        # multi-format festivals whose scraped name mentions every format on
        # offer ("... Standard & Blitz | 5000€"), so a single row's real
        # time control (say 60+30=90min, genuinely Classical) would get
        # overridden to "Blitz" just because that word also appears
        # somewhere in the (shared, multi-event) name text.
        name_category: str = self._extract_category(name)
        for cat in name_category.split(", "):
            if cat in time_classes:
                if tc_class is None and cat not in category_parts:
                    category_parts.append(cat)
            elif cat not in category_parts:
                category_parts.append(cat)

        return ", ".join(category_parts) if category_parts else "Open"

    def _extract_category(self, text: str) -> str:
        """Extract tournament category from text using precompiled patterns.

        Identifies tournament type (Open, S50+, Youth, Women) and time control
        (Blitz, Rapid, Classical) from tournament name and location text.

        Args:
            text: Tournament name and location text to analyze.

        Returns:
            Comma-separated string of detected categories. Returns 'Open, Unknown'
            if no categories detected.

        Example:
            >>> processor._extract_category('Barcelona Open S50+ Rapid')
            'Open, S50+, Rapid'
            >>> processor._extract_category('Generic Tournament')
            'Open, Unknown'
        """
        categories: list[str] = []

        # Tournament type - use precompiled patterns
        if self.REGEX_PATTERNS["open"].search(text):
            categories.append("Open")
        categories.extend(f"S{age}+" for age in senior_ages(text))
        if is_youth(text):
            categories.append("Youth")
        categories.extend(f"U{age}" for age in youth_ages(text))
        categories.extend(f"U{rating}" for rating in rating_ceilings(text))
        if self.REGEX_PATTERNS["women"].search(text):
            categories.append("Women")

        # Time control (important for filtering) - use precompiled patterns
        detected = [label for key, label in [
            ("blitz", "Blitz"), ("rapid", "Rapid"), ("classical", "Classical"),
        ] if self.REGEX_PATTERNS[key].search(text)]
        categories.extend(detected or ["Unknown"])

        return ", ".join(categories) if categories != ["Unknown"] else "Open, Unknown"
