# medtourney

Advanced chess tournament search tool for chess-results.com with powerful filtering capabilities.

## Overview

This tool helps you search for European chess tournaments in the next 3 months with advanced filtering options. Unlike the basic search on chess-results.com, this tool allows you to:

- Filter for **Open category** tournaments
- Exclude **youth-only** tournaments (ensuring not all players are below 18)
- Filter for **S50+ (Senior)** category tournaments
- Filter for **Mediterranean seaside** locations
- Combine multiple filters for precise searches

## Installation

1. Clone the repository:
```bash
git clone https://github.com/kobolcs/medtourney.git
cd medtourney
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Basic Search

Search for European open tournaments in the next 3 months (excluding youth-only):

```bash
python3 tournament_search.py
```

### Advanced Filtering

**Filter for Mediterranean seaside tournaments:**
```bash
python3 tournament_search.py --mediterranean
```

**Filter for tournaments with S50+ category:**
```bash
python3 tournament_search.py --senior
```

**Combine filters (Mediterranean seaside with S50+ category):**
```bash
python3 tournament_search.py --mediterranean --senior
```

**Include youth-only tournaments:**
```bash
python3 tournament_search.py --include-youth
```

**Include closed/invitation tournaments:**
```bash
python3 tournament_search.py --allow-closed
```

### Command-Line Options

- `--mediterranean` - Only show tournaments in Mediterranean seaside locations (Spain, France, Italy, Greece, Croatia, Malta, Cyprus, etc.)
- `--senior` - Only show tournaments with S50+ or veteran categories
- `--include-youth` - Include youth-only tournaments (default: excluded)
- `--allow-closed` - Include closed/invitation tournaments (default: open only)

## Features

### Automatic Filters

By default, the tool applies these filters:
- ✅ European countries only
- ✅ Next 3 months timeframe
- ✅ Open category tournaments
- ✅ Tournaments with adult players (excludes youth-only events)

### Optional Filters

You can enable these additional filters:
- 🏖️ Mediterranean seaside locations (Barcelona, Nice, Split, Athens, Malta, etc.)
- 👴 S50+ (Senior/Veteran) category

### Supported Locations

**European Countries:** Albania, Andorra, Austria, Belarus, Belgium, Bosnia, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Moldova, Monaco, Montenegro, Netherlands, North Macedonia, Norway, Poland, Portugal, Romania, Russia, San Marino, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Ukraine, United Kingdom

**Mediterranean Seaside:** Spain, France (Riviera), Italy, Greece, Croatia, Malta, Cyprus, Monaco, Albania, Montenegro, Slovenia (coast), Bosnia (coast)

## Testing

Run the test suite:

```bash
python3 -m pytest test_tournament_search.py -v
```

Or using unittest:

```bash
python3 test_tournament_search.py
```

## Example Output

```
Searching for European chess tournaments...
Date range: next 3 months (2025-11-07 to 2026-02-07)

Found 4 tournament(s):

================================================================================

Name: Barcelona Open Chess Championship 2025
Location: Barcelona, Spain
Date: 2025-11-22
Category: Open
Description: International open tournament with players of all ages
URL: https://chess-results.com/tournament1
--------------------------------------------------------------------------------

Name: Athens Senior Open
Location: Athens, Greece
Date: 2025-12-07
Category: Open, S50+
Description: Open tournament with special S50+ category
URL: https://chess-results.com/tournament2
--------------------------------------------------------------------------------
```

## Technical Details

- **Language:** Python 3.12+
- **Dependencies:** requests, beautifulsoup4, python-dateutil
- **Architecture:** Modular design with separate filter and search classes

## Note

This tool currently uses sample data for demonstration purposes. In a production environment, it would integrate with the chess-results.com website to fetch real tournament data. The filtering logic and user interface are fully functional and ready for integration with live data sources.

## Contributing

Feel free to submit issues or pull requests to improve the tool.

## License

MIT License
