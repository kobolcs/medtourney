/**
 * The country checklist (index.html #countryList) lists a country under more
 * than one region when it belongs to both - Spain under Mediterranean and
 * Atlantic, Turkey under Mediterranean and Black Sea & Caspian. Its copies
 * are separate checkboxes with the same value, so everything that reads or
 * changes the selection goes through here: codes are de-duplicated and the
 * copies of a country always agree.
 */

const COUNTRY_INPUTS = 'input[name="countryFilter"]';

/** Selected country codes, each once, in checklist order. */
export function checkedCountryCodes(root: ParentNode = document): string[] {
    const codes = Array.from(root.querySelectorAll<HTMLInputElement>(`${COUNTRY_INPUTS}:checked`))
        .map(cb => cb.value);
    return [...new Set(codes)];
}

/** (Un)check every copy of one country. */
export function setCountryChecked(code: string, checked: boolean, root: ParentNode = document): void {
    root.querySelectorAll<HTMLInputElement>(COUNTRY_INPUTS).forEach(cb => {
        if (cb.value === code) cb.checked = checked;
    });
}

/** After one copy changed, make the country's other copies match it. */
export function syncCountryCopies(source: HTMLInputElement, root: ParentNode = document): void {
    setCountryChecked(source.value, source.checked, root);
}

/** Uncheck every country. */
export function clearCountries(root: ParentNode = document): void {
    root.querySelectorAll<HTMLInputElement>(`${COUNTRY_INPUTS}:checked`).forEach(cb => {
        cb.checked = false;
    });
}
