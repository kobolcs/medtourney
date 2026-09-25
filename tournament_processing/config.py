"""TournamentProcessor mixin: Built-in fallback for config.json (country and Mediterranean location lists)."""



from tournament_processing.base import ProcessorBase


class ConfigMixin(ProcessorBase):
    """Built-in fallback for config.json (country and Mediterranean location lists)."""

    def _load_default_config(self) -> None:
        """Load fallback configuration if config.json is missing or invalid.

        Provides hardcoded sets of European countries, non-European countries,
        and Mediterranean locations as a fallback.
        """
        self.european_countries = {
            "albania", "andorra", "austria", "belarus", "belgium", "bosnia",
            "bulgaria", "croatia", "cyprus", "czech", "denmark", "estonia",
            "faroe islands", "finland", "france", "germany", "greece", "guernsey",
            "hungary", "iceland", "ireland", "isle of man", "italy", "jersey",
            "kosovo", "latvia", "liechtenstein", "lithuania",
            "luxembourg", "malta", "moldova", "monaco", "montenegro", "netherlands",
            "north macedonia", "norway", "poland", "portugal", "romania",
            "san marino", "serbia", "slovakia", "slovenia", "spain", "sweden",
            "switzerland", "turkey", "ukraine", "united kingdom", "england",
            "scotland", "wales", "northern ireland",
            "gbr", "ger", "fra", "esp", "ita", "ned",
            "aut", "cze", "hun", "pol", "cro", "gre", "srb", "rou", "ukr",
            "svk", "slo", "den", "nor", "swe", "fin", "bel", "sui", "por",
            "mne", "alb", "bih", "mlt", "cyp", "bul", "mkd", "kos",
            "eng", "sco", "wls", "irl", "isl", "ltu", "lva", "lat", "est",
            "arm", "geo", "aze", "mon", "mnc", "and", "lux", "lie", "fid",
            "gib", "gibraltar", "mda", "smr", "fai", "gci", "iom", "jci", "tur",
        }
        self.non_european_countries = {
            "russia", "moscow", "petersburg", "malaysia", "uae", "dubai", "qatar",
            "saudi", "china", "india", "indonesia", "singapore", "thailand",
            "vietnam", "philippines", "japan", "korea", "australia", "new zealand",
            "usa", "canada", "mexico", "brazil", "argentina", "chile", "peru",
            "colombia", "egypt", "morocco", "tunisia", "algeria", "south africa",
            "israel", "jordan", "lebanon", "iran", "iraq", "kazakhstan",
            "uzbekistan", "uruguay", "costa rica", "venezuela",
            "rus", "mas",
            "ind", "uzb", "kaz", "isr", "jpn", "chn", "can", "mex",
            "bra", "arg", "aus", "nzl", "sgp", "tha", "vnm", "phl",
            "kor", "egy", "mar", "tun", "dza", "zaf", "jor", "lbn",
            "irn", "irq", "qat", "are", "sau",
            "uru", "crc", "ven", "bol", "par", "ecu", "col", "chi",
            "jam", "cub", "pur", "dom", "gua", "hnd", "pan", "slv",
            "pak", "ban", "sri", "nep", "afg", "tpe", "hkg", "mgl",
        }
        self.mediterranean_locations = {
            "barcelona", "valencia", "alicante", "malaga", "marbella",
            "nice", "cannes", "monaco", "marseille", "montpellier",
            "genoa", "genova", "naples", "napoli", "sicily", "sicilia", "rome", "roma",
            "athens", "thessaloniki", "patras", "heraklion", "chania",
            "rhodes", "corfu", "crete", "kavala", "volos", "kalamata",
            "split", "dubrovnik", "rijeka", "zadar", "sibenik", "pula",
            "kotor", "budva", "tivat", "bar", "herceg novi", "ulcinj",
            "durres", "vlore", "saranda",
            "trieste", "venezia", "venice", "taranto", "lecce",
            "koper", "piran", "izola", "portoroz", "lucija",
            "malta", "valletta", "sliema", "limassol", "larnaca",
            "paphos", "cyprus", "neum",
            "sitges", "badalona", "formentera", "gibraltar",
            "bastia", "corsica", "agde", "sanremo",
            "porto san giorgio", "cattolica", "palau", "opatija",
            "hvar", "hersonissos", "ikaria", "paleochora", "agria",
            "neos marmaras", "petrovac", "monte carlo"
        }
