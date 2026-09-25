/**
 * The sea picker (index.html #seaPicker): which seas the Seaside mode counts.
 * Shown only in the Seaside / Both modes, so it adds no tab stops otherwise.
 */
import type { Sea } from '../types';
import { SEAS, isSea } from './seas';

const SEA_INPUTS = '#seaPicker input[name="sea"]';

/** The ticked seas, in SEAS order. */
export function checkedSeas(root: ParentNode = document): Sea[] {
    const ticked = new Set(
        Array.from(root.querySelectorAll<HTMLInputElement>(`${SEA_INPUTS}:checked`)).map(cb => cb.value)
    );
    return SEAS.filter(sea => ticked.has(sea));
}

/** Tick exactly these seas (unknown names ignored). */
export function setCheckedSeas(seas: readonly string[], root: ParentNode = document): void {
    const wanted = new Set(seas.filter(isSea));
    root.querySelectorAll<HTMLInputElement>(SEA_INPUTS).forEach(cb => {
        cb.checked = wanted.has(cb.value as Sea);
    });
}

/** Show the picker only while the Seaside mode is on. */
export function syncSeaPicker(seasideOn: boolean, root: Document = document): void {
    const picker = root.getElementById('seaPicker');
    if (picker) picker.hidden = !seasideOn;
}

/**
 * Call onChange when a sea is (un)ticked. Unticking the last one is undone -
 * Seaside with no sea would always be empty.
 */
export function initSeaPicker(onChange: () => void, root: ParentNode = document): void {
    root.querySelectorAll<HTMLInputElement>(SEA_INPUTS).forEach(cb => {
        cb.addEventListener('change', () => {
            if (!cb.checked && checkedSeas(root).length === 0) {
                cb.checked = true;
                return;
            }
            onChange();
        });
    });
}
