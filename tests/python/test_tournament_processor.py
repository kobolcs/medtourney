"""Unit tests for TournamentProcessor.py.

This module contains comprehensive unit tests for the TournamentProcessor class,
covering date parsing, European location detection, tournament filtering,
Excel file loading, and JSON export functionality.

Typical usage example:

    $ pytest tests/python/test_tournament_processor.py -v
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

import openpyxl
import pytest

from TournamentProcessor import TournamentProcessor


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

    @pytest.fixture
    def processor(self) -> TournamentProcessor:
        """Create a TournamentProcessor instance for testing.

        Returns:
            TournamentProcessor instance with loaded configuration.
        """
        return TournamentProcessor()

    @pytest.fixture
    def sample_tournaments(self) -> List[Dict[str, Any]]:
        """Generate sample tournament data for testing.

        Returns:
            List of tournament dictionaries with varied categories and locations.
        """
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        return [
            {
                "name": "Barcelona Open 2025",
                "location": "Barcelona, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Barcelona Open 2025"
            },
            {
                "name": "Athens Senior Championship",
                "location": "Athens, Greece",
                "date": tomorrow,
                "category": "Open, S50+, Classical",
                "url": "https://chess-results.com/test2",
                "description": "Athens Senior Championship"
            },
            {
                "name": "Youth Tournament U18",
                "location": "Paris, France",
                "date": tomorrow,
                "category": "Youth",
                "url": "https://chess-results.com/test3",
                "description": "Youth Tournament U18"
            }
        ]

    @pytest.fixture
    def sample_excel_file(self, tmp_path: Path) -> str:
        """Create a sample Excel file for testing.

        Creates an Excel file with tournament data including European tournaments,
        non-European tournaments (Dubai, Moscow), and past tournaments for testing
        the filtering logic.

        Args:
            tmp_path: Pytest fixture providing temporary directory path.

        Returns:
            String path to the created Excel file.
        """
        wb: openpyxl.Workbook = openpyxl.Workbook()
        ws = wb.active

        # Chess-results.com format: rows 1-3 are metadata, row 4 is headers
        ws.append(["Chess-results.com Tournament Export"])  # Row 1: metadata
        ws.append(["Export Date: 2025-01-01"])  # Row 2: metadata
        ws.append([])  # Row 3: empty

        # Row 4: Headers (chess-results.com format)
        ws.append(["Tournament", "Location", "from", "FED", "DB-Key"])

        # Sample data - dates in YYYYMMDD format (chess-results.com format)
        tomorrow: datetime = datetime.now() + timedelta(days=1)
        future_date: datetime = datetime.now() + timedelta(days=30)
        past_date: datetime = datetime.now() - timedelta(days=1)

        # Row 5+: Tournament data
        ws.append([
            "Barcelona Open 2025",
            "Barcelona",
            tomorrow.strftime("%Y%m%d"),
            "ESP",
            "12345"
        ])
        ws.append([
            "Athens Senior Open",
            "Athens",
            future_date.strftime("%Y%m%d"),
            "GRE",
            "12346"
        ])
        ws.append([
            "Dubai Open",
            "Dubai",
            future_date.strftime("%Y%m%d"),
            "UAE",
            "12347"
        ])
        ws.append([
            "Past Tournament",
            "Madrid",
            past_date.strftime("%Y%m%d"),
            "ESP",
            "12348"
        ])
        ws.append([
            "Moscow Championship",
            "Moscow",
            future_date.strftime("%Y%m%d"),
            "RUS",
            "12349"
        ])

        excel_file = tmp_path / "test_tournaments.xlsx"
        wb.save(excel_file)
        return str(excel_file)


    # ========== Date Parsing Tests ==========

    def test_parse_date_yyyymmdd(self, processor):
        """Test YYYYMMDD format (chess-results.com format)"""
        date = processor._parse_date("20251128")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_ddmmyyyy_dot(self, processor):
        """Test DD.MM.YYYY format"""
        date = processor._parse_date("28.11.2025")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_yyyymmdd_dash(self, processor):
        """Test YYYY-MM-DD format"""
        date = processor._parse_date("2025-11-28")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_ddmmyyyy_slash(self, processor):
        """Test DD/MM/YYYY format"""
        date = processor._parse_date("28/11/2025")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_datetime_object(self, processor):
        """Test passing a datetime object - naive datetimes get UTC timezone added"""
        dt = datetime(2025, 11, 28)
        date = processor._parse_date(dt)
        # Naive datetime should get UTC timezone added
        expected = datetime(2025, 11, 28, tzinfo=timezone.utc)
        assert date == expected

    def test_parse_date_invalid(self, processor):
        """Test invalid date returns current date"""
        date = processor._parse_date("invalid-date")
        today = datetime.now()
        assert date.date() == today.date()

    def test_parse_date_none(self, processor):
        """Test None returns current date"""
        date = processor._parse_date(None)
        today = datetime.now()
        assert date.date() == today.date()


    # ========== European Location Detection Tests ==========

    def test_is_european_spain(self, processor):
        """Test Spanish location detection"""
        assert processor._is_european("Barcelona, ESP") is True
        assert processor._is_european("Madrid, Spain") is True
        assert processor._is_european("españa") is True

    def test_is_european_france(self, processor):
        """Test French location detection"""
        assert processor._is_european("Paris, FRA") is True
        assert processor._is_european("Nice, France") is True

    def test_is_european_germany(self, processor):
        """Test German location detection"""
        assert processor._is_european("Berlin, GER") is True
        assert processor._is_european("Munich, Germany") is True

    def test_is_european_greece(self, processor):
        """Test Greek location detection"""
        assert processor._is_european("Athens, Greece") is True
        assert processor._is_european("GRE") is True

    def test_is_european_case_insensitive(self, processor):
        """Test case insensitivity"""
        assert processor._is_european("SPAIN") is True
        assert processor._is_european("spain") is True
        assert processor._is_european("Spain") is True

    def test_is_not_european_russia(self, processor):
        """Test Russia is excluded"""
        assert processor._is_european("Moscow, Russia") is False
        assert processor._is_european("Petersburg, RUS") is False

    def test_is_not_european_asia(self, processor):
        """Test Asian countries are excluded"""
        assert processor._is_european("Dubai, UAE") is False
        assert processor._is_european("Singapore") is False
        assert processor._is_european("Malaysia") is False
        assert processor._is_european("China") is False

    def test_is_not_european_americas(self, processor):
        """Test American countries are excluded"""
        assert processor._is_european("New York, USA") is False
        assert processor._is_european("Toronto, Canada") is False
        assert processor._is_european("Mexico City, Mexico") is False

    def test_is_not_european_unknown(self, processor):
        """Test unknown location returns False"""
        assert processor._is_european("Unknown") is False
        assert processor._is_european("") is False


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

    # ========== Tournament Filtering Tests ==========

    def test_filter_open_only(self, processor, sample_tournaments):
        """Test filtering for Open category only"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=True,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=False
        )
        assert len(filtered) == 2  # Barcelona and Athens have Open
        assert all("Open" in t["category"] for t in filtered)

    def test_filter_exclude_youth(self, processor, sample_tournaments):
        """Test excluding youth-only tournaments"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=False,
            exclude_youth=True,
            mediterranean_only=False,
            senior_only=False
        )
        # Youth tournament should be excluded
        assert len(filtered) == 2
        assert not any("youth" in t["category"].lower() and "open" not in t["category"].lower() for t in filtered)

    def test_filter_mediterranean_only(self, processor, sample_tournaments):
        """Test filtering for Mediterranean locations only"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )
        # Barcelona and Athens are Mediterranean
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("barcelona" in loc or "athens" in loc for loc in locations)

    def test_filter_mediterranean_spanish_cities(self, processor):
        """Test Mediterranean filter with various Spanish coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Palma Open",
                "location": "Palma de Mallorca, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Palma Open"
            },
            {
                "name": "Ibiza Blitz",
                "location": "Ibiza, ESP",
                "date": tomorrow,
                "category": "Open, Blitz",
                "url": "https://chess-results.com/test2",
                "description": "Ibiza Blitz"
            },
            {
                "name": "Madrid Open",
                "location": "Madrid, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test3",
                "description": "Madrid Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Only Palma and Ibiza should match (Madrid is not Mediterranean)
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("palma" in loc or "mallorca" in loc for loc in locations)
        assert any("ibiza" in loc for loc in locations)
        assert not any("madrid" in loc for loc in locations)

    def test_filter_mediterranean_italian_cities(self, processor):
        """Test Mediterranean filter with various Italian coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Palermo Open",
                "location": "Palermo, ITA",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Palermo Open"
            },
            {
                "name": "Cagliari Championship",
                "location": "Cagliari, Sardinia",
                "date": tomorrow,
                "category": "Open, Rapid",
                "url": "https://chess-results.com/test2",
                "description": "Cagliari Championship"
            },
            {
                "name": "Milan Open",
                "location": "Milan, ITA",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test3",
                "description": "Milan Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Only Palermo and Cagliari should match (Milan is not Mediterranean)
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("palermo" in loc for loc in locations)
        assert any("cagliari" in loc for loc in locations)
        assert not any("milan" in loc for loc in locations)

    def test_filter_mediterranean_greek_cities(self, processor):
        """Test Mediterranean filter with various Greek coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Rhodes Open",
                "location": "Rhodes, GRE",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Rhodes Open"
            },
            {
                "name": "Heraklion Championship",
                "location": "Heraklion, Crete",
                "date": tomorrow,
                "category": "Open, Rapid",
                "url": "https://chess-results.com/test2",
                "description": "Heraklion Championship"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Both should match
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("rhodes" in loc for loc in locations)
        assert any("heraklion" in loc or "crete" in loc for loc in locations)

    def test_filter_mediterranean_croatian_cities(self, processor):
        """Test Mediterranean filter with Croatian coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Zadar Open",
                "location": "Zadar, CRO",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Zadar Open"
            },
            {
                "name": "Zagreb Open",
                "location": "Zagreb, CRO",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test2",
                "description": "Zagreb Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Only Zadar should match (Zagreb is inland)
        assert len(filtered) == 1
        assert "zadar" in filtered[0]["location"].lower()

    def test_filter_senior_only(self, processor, sample_tournaments):
        """Test filtering for S50+ tournaments only"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=True
        )
        assert len(filtered) == 1
        assert "S50+" in filtered[0]["category"] or "senior" in filtered[0]["category"].lower()

    def test_filter_senior_with_veteran_keyword(self, processor):
        """Test senior filter matches 'veteran' keyword"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Veteran Championship",
                "location": "Madrid, ESP",
                "date": tomorrow,
                "category": "Open, S50+, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Veteran Championship"
            },
            {
                "name": "Regular Open",
                "location": "Barcelona, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test2",
                "description": "Regular Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=True
        )

        assert len(filtered) == 1
        assert "Veteran" in filtered[0]["name"]

    def test_filter_senior_with_50plus_keyword(self, processor):
        """Test senior filter matches '50+' keyword in category"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Championship 50+",
                "location": "Athens, GRE",
                "date": tomorrow,
                "category": "S50+, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Championship 50+"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=True
        )

        assert len(filtered) == 1
        assert "50+" in filtered[0]["name"]

    def test_filter_combined(self, processor, sample_tournaments):
        """Test multiple filters combined"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=True,
            exclude_youth=True,
            mediterranean_only=True,
            senior_only=False
        )
        # Should return Barcelona and Athens (both Open and Mediterranean)
        assert len(filtered) == 2


    # ========== Excel Loading Tests ==========

    def test_load_and_filter_tournaments(self, processor, sample_excel_file):
        """Test loading tournaments from Excel file"""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)

        # Should load 2 European tournaments (Barcelona and Athens)
        # Dubai, Moscow (Russia), and past tournament should be filtered out
        assert len(tournaments) >= 1  # At least Barcelona and Athens

        # Check all tournaments are European
        for t in tournaments:
            assert processor._is_european(t["location"])

        # Check no past tournaments
        tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        for t in tournaments:
            tournament_date = datetime.strptime(t["date"], "%Y-%m-%d")
            assert tournament_date >= tomorrow

    def test_load_excel_missing_file(self, processor):
        """Test loading from non-existent file raises error"""
        with pytest.raises(FileNotFoundError):
            processor.load_and_filter_tournaments("/nonexistent/file.xlsx")

    def test_load_detects_shifted_header_row(self, processor, tmp_path):
        """Headers not in the usual row 4 are still found (no silent zero results).

        Regression test: chess-results.com occasionally changes the number of
        leading metadata rows. Previously the parser hard-coded row 4 and would
        silently return zero tournaments when the layout shifted.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        # Headers in row 1 (no metadata preamble at all).
        ws.append(["Tournament", "Location", "from", "FED", "DB-Key"])
        future = (datetime.now() + timedelta(days=30)).strftime("%Y%m%d")
        ws.append(["Valencia Open", "Valencia", future, "ESP", "55501"])
        ws.append(["Lisbon Open", "Lisbon", future, "POR", "55502"])
        excel_file = tmp_path / "shifted.xlsx"
        wb.save(excel_file)

        tournaments = processor.load_and_filter_tournaments(str(excel_file))
        assert len(tournaments) == 2

    def test_load_raises_when_columns_missing(self, processor, tmp_path):
        """An unrecognisable export fails loudly instead of exporting empty data.

        Regression test: missing essential columns must raise rather than silently
        produce an empty tournament list that overwrites good data.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["foo", "bar", "baz"])
        ws.append([1, 2, 3])
        excel_file = tmp_path / "junk.xlsx"
        wb.save(excel_file)

        with pytest.raises(ValueError, match="Could not locate"):
            processor.load_and_filter_tournaments(str(excel_file))

    def test_load_skips_url_preamble_row(self, processor, tmp_path):
        """URL preamble row added by chess-results.com is not mistaken for the header.

        Regression test: row 1 of the chess-results.com Excel export now contains
        "from the tournament-database of chess-results https://chess-results.com".
        Both "tournament" and "from" appear in that single cell, which used to fool
        _detect_header_row into treating it as the header row and then failing to
        find any real columns.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        # Row 1: the URL preamble chess-results.com now prepends
        ws.append(["from the tournament-database of chess-results https://chess-results.com"])
        # Row 2: real column headers
        ws.append(["Tournament", "Location", "from", "FED", "DB-Key"])
        future = (datetime.now() + timedelta(days=30)).strftime("%Y%m%d")
        ws.append(["Valencia Open", "Valencia", future, "ESP", "55501"])
        excel_file = tmp_path / "preamble.xlsx"
        wb.save(excel_file)

        tournaments = processor.load_and_filter_tournaments(str(excel_file))
        assert len(tournaments) == 1
        assert tournaments[0]["name"] == "Valencia Open"

    def test_load_excel_validates_location(self, processor, sample_excel_file):
        """Test that non-European locations are filtered out"""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)

        # Dubai and Moscow should be filtered out
        locations = [t["location"] for t in tournaments]
        assert not any("dubai" in loc.lower() for loc in locations)
        assert not any("moscow" in loc.lower() for loc in locations)


    # ========== Scrape Metadata Tests ==========

    def test_load_populates_run_stats(self, processor, sample_excel_file):
        """load_and_filter_tournaments records per-run filtering stats."""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)
        stats = processor.last_run_stats

        # kept matches the returned list
        assert stats["keptRows"] == len(tournaments)
        # rawRows accounts for every processed row (kept + all exclusions)
        assert stats["rawRows"] >= stats["keptRows"]
        assert stats["rawRows"] == (
            stats["keptRows"]
            + stats["excludedPast"]
            + stats["excludedNonEuropean"]
            + stats["excludedInvalid"]
        )
        # The sample sheet contains past and non-European rows that get excluded.
        assert stats["excludedPast"] >= 1
        assert stats["excludedNonEuropean"] >= 1

    def test_export_metadata_writes_expected_fields(self, processor, sample_excel_file, tmp_path):
        """export_metadata writes a sidecar with the documented schema."""
        processor.load_and_filter_tournaments(sample_excel_file)

        meta_file = tmp_path / "tournaments_data_meta.json"
        returned = processor.export_metadata(str(meta_file))

        assert meta_file.exists()
        with meta_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert data == returned
        for key in (
            "generatedAt", "source", "rangeMonths", "rawRows", "keptRows",
            "excludedPast", "excludedNonEuropean", "excludedInvalid",
        ):
            assert key in data, f"metadata missing key: {key}"

        assert data["source"] == "chess-results.com"
        assert data["rangeMonths"] == processor.RANGE_MONTHS
        assert data["keptRows"] == processor.last_run_stats["keptRows"]


    # ========== JSON Export Tests ==========

    def test_export_to_json(self, processor, sample_tournaments, tmp_path):
        """Test exporting tournaments to JSON"""
        json_file = tmp_path / "tournaments.json"

        processor.export_to_json(sample_tournaments, str(json_file))

        # Verify file exists
        assert json_file.exists()

        # Verify content
        with json_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert len(data) == len(sample_tournaments)
        assert data[0]["name"] == "Barcelona Open 2025"

    def test_export_json_validation(self, processor, tmp_path):
        """Test JSON export validates tournament structure"""
        json_file = tmp_path / "tournaments.json"

        # Invalid tournament data (missing required fields)
        invalid_tournaments = [
            {"name": "Test"},  # Missing location, date, category, url
            {"name": "Valid", "location": "Barcelona", "date": "2025-11-28", "category": "Open", "url": "http://test.com"}
        ]

        processor.export_to_json(invalid_tournaments, str(json_file))

        # Should only export valid tournament
        with json_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert len(data) == 1
        assert data[0]["name"] == "Valid"

    def test_export_json_unicode(self, processor, tmp_path):
        """Test JSON export handles Unicode correctly"""
        json_file = tmp_path / "tournaments.json"

        unicode_tournaments = [
            {
                "name": "Torneo España 2025",
                "location": "Barcelona, España",
                "date": "2025-11-28",
                "category": "Open",
                "url": "https://chess-results.com/test",
                "description": "Torneo en España"
            }
        ]

        processor.export_to_json(unicode_tournaments, str(json_file))

        # Verify Unicode is preserved
        with json_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert "España" in data[0]["name"]
        assert "España" in data[0]["location"]


    # ========== Configuration Loading Tests ==========

    def test_config_loaded(self, processor):
        """Test that configuration is loaded correctly"""
        assert processor.european_countries is not None
        assert processor.non_european_countries is not None
        assert processor.mediterranean_locations is not None

        assert len(processor.european_countries) > 0
        assert len(processor.non_european_countries) > 0
        assert len(processor.mediterranean_locations) > 0

    def test_config_sets_type(self, processor):
        """Test that configuration uses Sets for O(1) lookup"""
        assert isinstance(processor.european_countries, set)
        assert isinstance(processor.non_european_countries, set)
        assert isinstance(processor.mediterranean_locations, set)


    # ========== Edge Cases and Error Handling ==========

    def test_empty_tournament_list(self, processor, tmp_path):
        """Test handling empty tournament list"""
        json_file = tmp_path / "empty.json"
        processor.export_to_json([], str(json_file))

        with json_file.open() as f:
            data = json.load(f)

        assert data == []

    def test_find_column_not_found(self, processor):
        """Test column finding when header not present"""
        headers = ["col1", "col2", "col3"]
        result = processor._find_column(headers, ["nonexistent", "missing"])
        assert result is None

    def test_find_column_found(self, processor):
        """Test column finding success"""
        headers = ["name", "location", "date"]
        result = processor._find_column(headers, ["name", "tournament"])
        assert result == 0

    def test_find_column_exact_match_precedes_substring(self, processor):
        """Exact header matches win over substrings.

        Regression test: "to" is a substring of "tournament", so a pure
        substring search resolved the end-date column to the tournament name
        column whenever "tournament" appeared earlier in the header row.
        """
        headers = ["tournament", "from", "to", "fed"]
        result = processor._find_column(headers, ["to", "end", "bis"])
        assert result == 2

    def test_find_columns_matches_real_chess_results_headers(self, processor):
        """The live chess-results.com header row resolves date_to correctly.

        Regression test: with the real export headers, date_to_col used to
        collapse onto name_col (both resolved to 0) because "to" matched
        inside "tournament" first.
        """
        headers = [
            "tournament", "from", "to", "eventid", "organizer(s)",
            "tournament director", "chief arbiter", "deputy chief arbiter",
            "arbiter", "location", "time control", "fed", "state",
            "last update ", "teams", "n", "rd", "rd-akt", "db-key", "system",
        ]
        name_col, _location_col, _date_from_col, date_to_col, *_ = processor._find_columns(headers)
        assert date_to_col == 2
        assert date_to_col != name_col

    def test_load_drops_end_date_before_start_date(self, processor, tmp_path):
        """A bogus end date earlier than the start date is dropped, not published.

        Regression test: `_parse_date` falls back to "now" on any parse
        failure, so a misidentified end-date column used to silently publish
        today's date as a plausible-looking dateTo for every row. Dropping any
        end date earlier than the start date keeps that garbage out of
        tournaments_data.json even if a column is misidentified again.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        # Headers in row 1 - no metadata preamble above them, since the header
        # detector would latch onto any earlier row containing "tournament".
        ws.append(["Tournament", "from", "to", "Location", "FED"])
        future_start = (datetime.now() + timedelta(days=30)).strftime("%Y%m%d")
        earlier_end = (datetime.now() + timedelta(days=10)).strftime("%Y%m%d")
        ws.append(["Valencia Open", future_start, earlier_end, "Valencia", "ESP"])
        excel_file = tmp_path / "bad_end_date.xlsx"
        wb.save(excel_file)

        tournaments = processor.load_and_filter_tournaments(str(excel_file))
        assert len(tournaments) == 1
        assert tournaments[0]["dateTo"] == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
