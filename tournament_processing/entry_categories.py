"""Explicit entry ages and rating ceilings; venue names and clocks are not eligibility."""
import re

MAX_YOUTH_AGE = 21

YOUTH = re.compile(r"\b(?:youth|junior\w*|młodzie[żz]\w*|[žż]iak\w*|ml[áa]de[žz]\w*|ifjúság\w*|jugend\w*|jeune\w*|juvenil\w*|joven\w*|giovan\w*|school\w*|schule\w*|école\w*|escuela\w*|scuola\w*|szkoł\w*|škol\w*|kadet\w*)", re.I)
SENIOR = re.compile(r"\b(?:senior(?!\s+(?:high\s+|secondary\s+)?school)\w*|v[eé]t[eé]ran\w*|weteran\w*)", re.I)


def _numbers(text: str, patterns: list[str], minimum: int, maximum: int) -> list[int]:
    values = [int(match[1]) for pattern in patterns for match in re.finditer(pattern, text, re.I)]
    return sorted({value for value in values if minimum <= value <= maximum})


def youth_ages(text: str) -> list[int]:
    """Explicit U/Under and regional youth notation, including joined export text."""
    patterns = [r"(?:^|[^a-z])u[-\s]*0?(\d{1,2})(?!\d)", r"\bunder\s*0?(\d{1,2})(?!\d)",
                r"\b(?:hd|do|bis|sub)[-\s]*0?(\d{1,2})(?!\d)"]
    if YOUTH.search(text):
        patterns += [r"under\s*0?(\d{1,2})(?!\d)", r"\b(?:open|fete)\s+0?(\d{1,2})(?!\d)"]
    ages = _numbers(text, patterns, 1, MAX_YOUTH_AGE)
    ages += [int(m[1]) for m in re.finditer(r"Under\s*0?(\d{1,2})(?!\d)", text) if 1 <= int(m[1]) <= MAX_YOUTH_AGE]
    return sorted(set(ages))


def rating_ceilings(text: str) -> list[int]:
    """Parse explicit upper bounds; never guess from a plain rating or lower bound."""
    return _numbers(text, [r"(?:^|[^a-z])(?:u|under|sub)[-\s]*(\d{3,4})(?!\d)",
        r"\b(?:elo|rating|rated)\s*(?:<\s*=?|≤|(?:inferior(?:e)?\s*(?:a|to)?|max(?:imum)?|under)\s*)\s*(\d{3,4})(?!\d)"], 100, 3999)


def senior_ages(text: str) -> list[int]:
    """Explicit senior cohorts take precedence over generic senior wording."""
    ages = _numbers(text, [r"\b(?:s\s*|over\s*|o)(50|60|65|70|75|80)(?!\d)(?:\+(?!\s*\d))?(?![+\w])",
        r"\b(50|60|65|70|75|80)\s*\+(?!\s*\d)"], 50, 80)
    return ages or ([50] if SENIOR.search(text) else [])


def is_youth(text: str) -> bool:
    """Youth wording or a genuine youth age, never an adult rating ceiling."""
    return bool(YOUTH.search(text) or youth_ages(text))
