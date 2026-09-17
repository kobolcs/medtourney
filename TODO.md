# MedTourney – TODO pre Claude Code

Zoznam konkrétnych vylepšení podľa produktového posudku (2026-09-17).
Každá položka má odhad náročnosti a očakávaný prínos.

---

## 🟢 Rýchle výhry (do 1 dňa)

### 1. Pridaj web analytiku (Plausible alebo Fathom)
- **Prínos:** Zistíš za týždeň, či projekt má reálnych používateľov
- **Náročnosť:** ~1 hodina
- **Čo urobiť:**
  - Zaregistrovať sa na plausible.io (free tier pre open-source)
  - Pridať `<script defer data-domain="kobolcs.github.io/medtourney" src="https://plausible.io/js/script.js"></script>` do `index.html`
  - Nastaviť custom events pre: Search click, Filter usage, CSV export, ICS export, Shortlist add

### 2. Oprav zlyhávajúce federácie v scraperi
- **Prínos:** WLS (Wales), MLT (Malta), MNE (Montenegro) a ďalšie chýbajú v dátach
- **Náročnosť:** 2–3 hodiny
- **Čo urobiť:**
  - Pozri `robot-logs/` – AND, DEN, GIB, IOM, JCI, KOS, MNC, NOR, SMR tiež zlyhávajú
  - CookieBot overlay blokuje klik na Excel tlačidlo; `dismiss_cookies()` helper v `run_scraper.py` treba debugovať pre tieto federácie
  - Zvážiť `page.evaluate()` na priame odstránenie `#CybotCookiebotDialog` pred klikom

### ~~3. Pridaj `sitemap.xml` a `robots.txt`~~ ✅ (2026-09-17)
- **Prínos:** Google indexácia, SEO
- **Náročnosť:** 30 minút
- **Čo urobiť:**
  - Vytvoriť `/public/sitemap.xml` s jednou URL (SPA)
  - Vytvoriť `/public/robots.txt` s `Allow: /` a odkazom na sitemap

---

## 🟡 Stredné (do 2 týždňov)

### 4. "Turnaj týždňa" sekcia
- **Prínos:** Kurátorský obsah, zdieľateľné na chess fórach, zvyšuje návrat používateľov
- **Náročnosť:** ~1 deň
- **Čo urobiť:**
  - Automaticky vybrať mediteránny turnaj začínajúci do 30 dní s dateTo (trvanie > 5 dní)
  - Zobraziť ako highlighted card nad výsledkami
  - Logika výberu: `mediterraneanOnly=true`, najbližší štart, najdlhšie trvanie ako tiebreaker
  - Pridať do `UIManager.ts` metódu `renderFeaturedTournament(tournament)`

### 5. Email notifikácie na nové turnaje
- **Prínos:** Aktívni používatelia sa vrátia bez opakovania manuálneho vyhľadávania
- **Náročnosť:** 2–3 dni
- **Čo urobiť:**
  - Použiť [Resend](https://resend.com) free tier alebo Mailchimp
  - Forma: jednoduchý subscribe box (email + krajina/filter)
  - Weekly digest: nové turnaje pridané za posledný týždeň podľa uložených preferencií
  - Keďže ide o statickú stránku, potrebné serverless function (napr. Cloudflare Workers free)

### 6. Ratingový filter pre dospelých (U1400, U1600, U1800, U2000, U2200)
- **Prínos:** Veľká časť hráčov hľadá turnaje vo svojom ratingovom pásme
- **Náročnosť:** ~4 hodiny (podobná implementácia ako U-kategórie)
- **Čo urobiť:**
  - Pridať `ratingCategory: string` do `FilterState`
  - Pridať `ratingCategory` select do `index.html` (vedľa Youth Category)
  - Vzor matching: `\bU1400\b`, `\bU[-\s]?1400\b` atď. v name + category
  - Vzorové hodnoty v dátach: U1400, U1500, U1600, U1750, U1800, U1900, U2000, U2100, U2200, U2400

### 7. Multi-country výber
- **Prínos:** Používatelia plánujúci cestu po viacerých krajinách (napr. Španielsko + Taliansko)
- **Náročnosť:** ~1 deň
- **Čo urobiť:**
  - Zmeniť `countryFilter: string` na `countryFilter: string[]` v `FilterState`
  - Nahradiť `<select>` checkboxlist alebo multi-select komponentom
  - OR logika: turnaj prejde ak jeho lokácia obsahuje niektorú z vybraných krajín
  - Aktualizovať `FilterService`, `app.ts`, testy

---

## 🔴 Strategické (mení smer alebo rozsah)

### 8. Používateľské profily s ELO a odporúčaniami
- **Prínos:** Skutočná diferenciácia od chess-results.com; personalizovaný feed
- **Náročnosť:** Veľká zmena architektúry (potrebný backend)
- **Čo urobiť:**
  - Zvážiť Supabase alebo Firebase (free tier) ako lightweight backend
  - Profil: ELO rating, preferované krajiny, kategória (senior/open/youth), min. trvanie
  - Automatické odporúčania: "Toto by sa ti mohlo páčiť" na základe profilu
  - **Pozor:** Zásadne mení charakter projektu zo statickej stránky na app

### 9. Eliminácia rizika scrapingu – officiálny zdroj dát
- **Prínos:** Eliminuje krehkosť celého pipeline
- **Náročnosť:** Neistý výsledok (závisí od chess-results.com / FIDE)
- **Čo urobiť:**
  - Kontaktovať chess-results.com ohľadom API alebo dátového exportu
  - Skontrolovať FIDE calendar API (existuje, ale obmedzený)
  - Alternatíva: pridať druhý zdroj dát (napr. Schachbund pre GER, USET pre ESP) ako fallback

### 10. Rozšírenie na ďalšie deskové hry
- **Prínos:** Väčšia cieľová skupina pri rovnakom kóde
- **Náročnosť:** 2–3 týždne
- **Čo urobiť:**
  - Bridž: bridgeresults.com, EBL calendar
  - Go: europeangochampionship.eu
  - Parametrizovať `config.json` pre rôzne hry (iné krajiny, iné kategórie)

---

## ⛔ Čo nerobiť / zastaviť

- **Ďalšie checkbox filtre bez analytiky** – nevieš, ktoré filtre reálni používatelia používajú. Počkaj na dáta z bodu 1.
- **iCalendar export pre jednotlivý turnaj** – pravdepodobne nulové použitie; shortlist export áno
- **Komplexnejší Playwright scraping pipeline** – každé pridanie zvyšuje krehkosť. Stabilizovať existujúce pred rozširovaním.

---

## 📏 Metriky úspešnosti

Pred ďalším vývojom overiť:
1. **Analytika (bod 1) po 4 týždňoch:** Ak < 50 unikátnych používateľov/týždeň → osobný nástroj, nie produkt
2. **Post na r/chess / šachové skupiny:** Ak < 10 komentárov s reálnymi otázkami → záujem nie je dostatočný
3. **Mediteránny filter:** Spočítať, koľko turnajov prejde `mediterraneanOnly=true` na 6 mesiacov dopredu – ak < 20, core use case je príliš niche

---

*Posudok: Claude Sonnet 4.6, 2026-09-17*
