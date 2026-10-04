/** Copy plain text in modern browsers, with a small fallback for older Safari. */
export async function copyTextToClipboard(value: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch {
        // Clipboard permissions can be denied even in a secure context; try the fallback.
    }

    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    try {
        const copied = document.execCommand('copy');
        input.remove();
        return copied;
    } catch {
        input.remove();
        return false;
    }
}
