const OPEN = /\b(open|offene?n?|abierto|aberto|aperto|otwarty|ouvert|nyílt|otvoreni?)\b/i;
const RESTRICTED = new RegExp([
    'invitational', 'invitation', 'invitacional', 'zaproszeniow\\w*', 'einladungs\\w*',
    'closed', 'zamknięt\\w*', 'geschlossen\\w*',
    'round[- ]?robin', '\\brr\\b', 'rundenturnier',
    '\\b(gm|im|wgm|wim)[- ]?(norm|tournament|turnier)\\w*', 'norm (event|tournament)',
    'club championship', 'clubkampioenschap\\w*', 'vereinsmeisterschaft\\w*', 'klubmeisterschaft\\w*',
    'campionato sociale', 'torneo sociale', 'championnat du club', 'internal',
].join('|'), 'i');
export function isRestrictedEvent(name, category) {
    const text = `${name} ${category}`;
    if (OPEN.test(text))
        return false;
    return RESTRICTED.test(text);
}
//# sourceMappingURL=openEvents.js.map