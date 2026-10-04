import { copyTextToClipboard } from './clipboard';

/** Copy the active filter URL, leaving a tournament detail deep link out. */
export function initSearchShare(): void {
    document.getElementById('shareSearchBtn')?.addEventListener('click', (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const shareUrl = new URL(location.href);
        shareUrl.searchParams.delete('t');
        void copyTextToClipboard(shareUrl.toString()).then(copied => {
            button.textContent = copied ? 'Link copied' : 'Copy failed';
            window.setTimeout(() => { button.textContent = 'Share search'; }, 1800);
        });
    });
}
