const COUNTRY_INPUTS = 'input[name="countryFilter"]';
export function checkedCountryCodes(root = document) {
    const codes = Array.from(root.querySelectorAll(`${COUNTRY_INPUTS}:checked`))
        .map(cb => cb.value);
    return [...new Set(codes)];
}
export function setCountryChecked(code, checked, root = document) {
    root.querySelectorAll(COUNTRY_INPUTS).forEach(cb => {
        if (cb.value === code)
            cb.checked = checked;
    });
}
export function syncCountryCopies(source, root = document) {
    setCountryChecked(source.value, source.checked, root);
}
export function clearCountries(root = document) {
    root.querySelectorAll(`${COUNTRY_INPUTS}:checked`).forEach(cb => {
        cb.checked = false;
    });
}
//# sourceMappingURL=countrySelection.js.map