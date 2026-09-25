"""Unit tests for TournamentProcessor.py: category extraction and time-control classification.

Shared fixtures (processor, sample_tournaments, sample_excel_file) are in
tests/python/conftest.py.
"""


import pytest


class TestTournamentProcessor:
    """Test suite for TournamentProcessor class.

    Provides comprehensive testing of all TournamentProcessor methods including:
    - Date parsing from multiple formats
    - European location detection and filtering
    - Tournament category extraction
    - Excel file loading and processing
    - JSON export with validation
    - Configuration loading
    """

    # ========== Category Extraction Tests ==========

    def test_extract_category_open(self, processor):
        """Test Open category detection"""
        category = processor._extract_category("Barcelona Open Championship")
        assert "Open" in category

    def test_extract_category_senior(self, processor):
        """Test S50+ category detection"""
        category = processor._extract_category("Senior Championship S50+")
        assert "S50+" in category

        category = processor._extract_category("Veteran Tournament")
        assert "S50+" in category

    def test_extract_category_youth(self, processor):
        """Test Youth category detection"""
        category = processor._extract_category("Youth U18 Championship")
        assert "Youth" in category

        category = processor._extract_category("Junior Tournament U16")
        assert "Youth" in category

    def test_extract_category_women(self, processor):
        """Test Women category detection"""
        category = processor._extract_category("Women Championship")
        assert "Women" in category

        category = processor._extract_category("Ladies Tournament")
        assert "Women" in category

    def test_extract_category_blitz(self, processor):
        """Test Blitz time control detection"""
        category = processor._extract_category("Blitz Championship")
        assert "Blitz" in category

    def test_extract_category_rapid(self, processor):
        """Test Rapid time control detection"""
        category = processor._extract_category("Rapid Open")
        assert "Rapid" in category

    def test_extract_category_classical(self, processor):
        """Test Classical time control detection"""
        category = processor._extract_category("Classical Championship")
        assert "Classical" in category

    def test_extract_category_default(self, processor):
        """Test default category when nothing matches"""
        category = processor._extract_category("Generic Tournament")
        assert "Classical" in category  # Should default to Classical

    def test_extract_category_multiple(self, processor):
        """Test multiple categories"""
        category = processor._extract_category("Open Senior S50+ Rapid Championship")
        assert "Open" in category
        assert "S50+" in category
        assert "Rapid" in category

    # ========== Time Control Classification Tests (FIDE formula) ==========
    # total = base_minutes + increment_seconds; Blitz <=10, Rapid <60, else Classical

    def test_classify_by_fide_formula_bare_plus(self, processor):
        """Bare 'N+M' format sums to the right bracket"""
        assert processor._classify_by_fide_formula("10+5") == "Rapid"
        assert processor._classify_by_fide_formula("90+30") == "Classical"
        assert processor._classify_by_fide_formula("3+2") == "Blitz"

    def test_classify_by_fide_formula_plus_sec_connector(self, processor):
        """'+'/'plus' before the increment already worked before this fix"""
        assert processor._classify_by_fide_formula("10 min + 5 sec") == "Rapid"
        assert processor._classify_by_fide_formula("20 minutes plus 10 seconds") == "Rapid"

    def test_classify_by_fide_formula_prose_with_connector(self, processor):
        """Regression: 'N minutes with M second increment' was dropping the
        increment entirely (only '+'/'plus' were recognized as connectors),
        undercounting the total and misclassifying real chess-results.com
        tournaments - e.g. a 45+15 (=60) game was coming out as Rapid
        instead of Classical."""
        assert processor._classify_by_fide_formula(
            "45 minutes with 15 second increment from move 1"
        ) == "Classical"
        assert processor._classify_by_fide_formula(
            "30 minutes for game with 30 seconds increment from move 1"
        ) == "Classical"
        assert processor._classify_by_fide_formula(
            "8 minutes with 3 second increment from move 1"
        ) == "Rapid"

    def test_classify_by_fide_formula_increment_of_phrasing(self, processor):
        """'... with an increment of N seconds ...' - connector isn't
        directly before the number at all here."""
        assert processor._classify_by_fide_formula(
            "50 minutes to the end of the game with an increment of 10 seconds per move"
        ) == "Classical"

    def test_classify_by_fide_formula_no_increment(self, processor):
        """No increment mentioned at all - just the base minutes"""
        assert processor._classify_by_fide_formula("25 minutes") == "Rapid"
        assert processor._classify_by_fide_formula("90 minutes") == "Classical"

    def test_classify_by_fide_formula_prime_notation(self, processor):
        """Regression: chess-results.com's own compact "N' + M''" notation
        (prime = minutes, double prime = seconds) was falling through to
        Blitz because the increment regex only recognized a literal 's...'
        word for seconds, never a bare quote/prime marker - e.g. "10' + 2''"
        (10+2=12, actually Rapid) was coming out as Blitz. Real example:
        chess-results.com/tnr1470230.aspx, timeControl "10' + 2''"."""
        assert processor._classify_by_fide_formula("10' + 2''") == "Rapid"
        assert processor._classify_by_fide_formula("10'+5\"") == "Rapid"
        assert processor._classify_by_fide_formula("10'05''") == "Rapid"
        assert processor._classify_by_fide_formula("30'+30\"") == "Classical"

    def test_classify_by_fide_formula_non_english_unit_words(self, processor):
        """The base/increment regexes match "min"/"sec" as a prefix, not a
        whole word, specifically so this works: real chess-results.com data
        spells "minutes"/"seconds" in a dozen languages ("Minuten",
        "minutos", "minut", "minuter", "minūtes", "Sekunden", "segundos",
        "sekund", ...), all sharing only that short English prefix. Anchoring
        with \\b to prevent an unrelated word (e.g. "sections") from also
        matching "sec" was tried and reverted - it broke matching for every
        one of these languages, since none happen to end a word right after
        "min"/"sec". Pin the multi-language behavior so it isn't "fixed"
        that way again."""
        assert processor._classify_by_fide_formula("10 minuten + 5 sekunden/zug") == "Rapid"
        assert processor._classify_by_fide_formula("10 minutos + 5 segundos") == "Rapid"
        assert processor._classify_by_fide_formula("10 minut + 5 sekund za tah") == "Rapid"
        assert processor._classify_by_fide_formula("90 minuten + 30 sek pro zug") == "Classical"

    def test_classify_by_fide_formula_backtick_notation(self, processor):
        """Regression: some sources' apostrophes come through as a
        backtick instead of a real apostrophe/prime, e.g.
        "8`+ 3\" por mov" (8+3=11, actually Rapid) - unrecognized entirely
        by either the prime-notation or word-based paths, so it fell
        through to the "Classical" default. Real example:
        'I Open de Ajedrez Puerto Moral', timeControl "8 `+ 3\" por mov"."""
        assert processor._classify_by_fide_formula('8 `+ 3" por mov') == "Rapid"
        assert processor._classify_by_fide_formula("10`+5``") == "Rapid"
        assert processor._classify_by_fide_formula("60`+30``") == "Classical"

    def test_classify_by_fide_formula_slash_notation(self, processor):
        """Regression: some UK clubs write base/increment as "N/M" instead
        of "N+M" (e.g. "15/5", "3/2"), unrecognized entirely before this -
        real example: '8th Epsom Chess Club SRCA RapidPlay Open',
        timeControl "15/5" (15+5=20, actually Rapid), was defaulting to
        Classical despite the tournament's own name saying RapidPlay.

        Only matches when the ENTIRE string is just two numbers and a
        slash: "/" is also used for moves-count formats like "40/90 Min,
        Rest 15 Min" (40 moves per 90 min, not 40+90), which always carry
        extra text around the slash and must NOT be picked up here."""
        assert processor._classify_by_fide_formula("15/5") == "Rapid"
        assert processor._classify_by_fide_formula("3/2") == "Blitz"
        assert processor._classify_by_fide_formula("40/90 Min, Rest 15 Min") is None

    def test_extract_category_rapid_blitz_compound_words(self, processor):
        """Regression: \\brapid\\b/\\bblitz\\b (trailing word boundary)
        missed real tournament names across languages where the word
        doesn't end right there - German "Blitzschach"/"Blitzturnier",
        English "RapidPlay"/"Rapidplay", and even the plain French word
        "rapide" (still means "rapid", just spelled with a trailing e).
        Affected 67 real tournaments, all silently defaulting to
        Classical instead."""
        assert "Blitz" in processor._extract_category("NRW Senioren Blitzschach 2026")
        assert "Rapid" in processor._extract_category("8th Epsom Chess Club SRCA RapidPlay Open")
        assert "Rapid" in processor._extract_category("Rapide FIDE Perpignan 27 Septembre 2026")

    def test_determine_category_name_signal_only_used_as_fallback(self, processor):
        """A tournament's own name can say "rapid"/"blitz" as a fallback
        signal when the time-control field gives nothing (empty or
        unparseable) - but must NOT override a class the time-control
        field's numbers already successfully computed. Tried making the
        name an override and reverted it: several real listings are
        multi-format festivals whose scraped name mentions every format on
        offer (e.g. "GOLDEN RHODOPES CHESS FESTIVAL 2026 ... Standard &
        Blitz | 5000€"), so a single row's real time control (60+30=90min,
        genuinely Classical) would get overridden to "Blitz" just because
        that word also appears somewhere in the shared, multi-event name."""
        # No time control at all - the name is the only signal available.
        assert processor._determine_category(
            "Rapide FIDE Perpignan 27 Septembre 2026", "Perpignan, FRA", ""
        ) == "Rapid"

        # A well-formed time control that computes Classical must win over
        # a same-named "Blitz" mention elsewhere in a multi-format name.
        category = processor._determine_category(
            "GOLDEN RHODOPES CHESS FESTIVAL 2026 Standard & Blitz | 5000€",
            "Zlatograd, BUL",
            "60+30"
        )
        assert "Classical" in category
        assert "Blitz" not in category

    def test_determine_category_keyword_overrides_formula(self, processor):
        """An explicit 'Rapid'/'Classical' label in the source data is
        trusted even where the formula would (in isolation) agree or
        disagree - organizers' own labels take priority over inference."""
        category = processor._determine_category("Open", "Budapest, HUN", "Rapid: 8 minutes with 3 second increment")
        assert "Rapid" in category


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
