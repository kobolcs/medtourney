import { SEAS, isSea } from './seas';
const SEA_INPUTS = '#seaPicker input[name="sea"]';
export function checkedSeas(root = document) {
    const ticked = new Set(Array.from(root.querySelectorAll(`${SEA_INPUTS}:checked`)).map(cb => cb.value));
    return SEAS.filter(sea => ticked.has(sea));
}
export function setCheckedSeas(seas, root = document) {
    const wanted = new Set(seas.filter(isSea));
    root.querySelectorAll(SEA_INPUTS).forEach(cb => {
        cb.checked = wanted.has(cb.value);
    });
}
export function syncSeaPicker(seasideOn, root = document) {
    const picker = root.getElementById('seaPicker');
    if (picker)
        picker.hidden = !seasideOn;
}
export function initSeaPicker(onChange, root = document) {
    root.querySelectorAll(SEA_INPUTS).forEach(cb => {
        cb.addEventListener('change', () => {
            if (!cb.checked && checkedSeas(root).length === 0) {
                cb.checked = true;
                return;
            }
            onChange();
        });
    });
}
//# sourceMappingURL=seaPicker.js.map