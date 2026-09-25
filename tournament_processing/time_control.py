"""TournamentProcessor mixin: Classical / Rapid / Blitz from the time-control field (FIDE 60-move formula) or the name."""

import re

from tournament_processing.base import ProcessorBase


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
        m = re.search(r"(\d+)\s*(h(?:our)?s?|min(?:ute)?s?|['′`])", tc_lower)  # noqa: RUF001 (deliberate: matches real prime-mark notation)
        if m:
            val = int(m.group(1))
            base = val * 60 if m.group(2).startswith("h") else val
            m2 = re.search(
                r"(\d+)\s*(?:s(?:ec|ek|eg|ekunde|econds?|ekundy)?|['′`]{2}|[\"″])",  # noqa: RUF001 (deliberate: double-prime seconds notation)
                tc_lower[m.end():]
            )
            inc = int(m2.group(1)) if m2 else 0
            return self._total_to_class(base + inc)

        return None

    def _classify_time_control_field(self, time_control: str) -> str | None:
        """Classify the time-control field's text alone: an explicit
        "blitz"/"rapid"/"classical"/"standard" keyword if present, else the
        FIDE 60-move formula's guess from the time-control numbers.
        """
        if not time_control:
            return None

        tc_lower = time_control.lower()
        if "blitz" in tc_lower:
            return "Blitz"
        if "rapid" in tc_lower:
            return "Rapid"
        if "classical" in tc_lower or "standard" in tc_lower:
            return "Classical"

        # FIDE 60-move formula: total = base_minutes + increment_seconds
        # Blitz: total <= 10 min; Rapid: 10 < total < 60; Classical: >= 60
        return self._classify_by_fide_formula(tc_lower)

    def _determine_category(self, name: str, location: str, time_control: str) -> str:
        """Determine tournament category from time control and name."""
        time_classes = {"Classical", "Rapid", "Blitz"}
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
        name_category: str = self._extract_category(name + " " + location)
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
            Comma-separated string of detected categories. Returns 'Open, Classical'
            if no categories detected.

        Example:
            >>> processor._extract_category('Barcelona Open S50+ Rapid')
            'Open, S50+, Rapid'
            >>> processor._extract_category('Generic Tournament')
            'Open, Classical'
        """
        categories: list[str] = []

        # Tournament type - use precompiled patterns
        if self.REGEX_PATTERNS["open"].search(text):
            categories.append("Open")
        if self.REGEX_PATTERNS["s50"].search(text):
            categories.append("S50+")
        if self.REGEX_PATTERNS["youth"].search(text):
            categories.append("Youth")
        if self.REGEX_PATTERNS["women"].search(text):
            categories.append("Women")

        # Time control (important for filtering) - use precompiled patterns
        if self.REGEX_PATTERNS["blitz"].search(text):
            categories.append("Blitz")
        elif self.REGEX_PATTERNS["rapid"].search(text):
            categories.append("Rapid")
        elif self.REGEX_PATTERNS["classical"].search(text) or not any(pattern.search(text) for pattern in [
            self.REGEX_PATTERNS["blitz"],
            self.REGEX_PATTERNS["rapid"],
            self.REGEX_PATTERNS["classical"]
        ]):
            categories.append("Classical")

        return ", ".join(categories) if categories else "Open, Classical"
