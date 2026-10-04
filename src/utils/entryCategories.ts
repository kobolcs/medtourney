/** Entry restrictions: age markers and rating ceilings must not share a numeric parser. */
export interface EntryCategories { youth: boolean; ages: number[]; seniors: number[]; ratings: number[] }
const YOUTH = /(?:^|[^\p{L}])(?:youth|junior\w*|młodzie[żz]\w*|[žż]iak\w*|ml[áa]de[žz]\w*|ifjúság\w*|jugend\w*|jeune\w*|juvenil\w*|joven\w*|giovan\w*|school\w*|schule\w*|école\w*|escuela\w*|scuola\w*|szkoł\w*|škol\w*|kadet\w*)/iu;
const SENIOR = /(?:^|[^\p{L}])(?:senior(?!\s+(?:high\s+|secondary\s+)?school)\w*|v[eé]t[eé]ran\w*|weteran\w*)/iu;
function numbers(text: string, patterns: RegExp[], min: number, max: number): number[] {
    const values = patterns.flatMap(pattern => [...text.matchAll(pattern)].map(match => Number(match[1])));
    return [...new Set(values.filter(value => value >= min && value <= max))].sort((a, b) => a - b);
}
export function youthAges(text: string): number[] {
    const patterns = [/(?:^|[^a-z])u[-\s]*0?(\d{1,2})(?!\d)/gi, /\bunder\s*0?(\d{1,2})(?!\d)/gi,
        /Under\s*0?(\d{1,2})(?!\d)/g, /\b(?:hd|do|bis|sub)[-\s]*0?(\d{1,2})(?!\d)/gi];
    if (YOUTH.test(text)) patterns.push(/\b(?:open|fete)\s+0?(\d{1,2})(?!\d)/gi);
    return numbers(text, patterns, 1, 21);
}
export function ratingCeilings(text: string): number[] {
    return numbers(text, [/(?:^|[^a-z])(?:u|under|sub)[-\s]*(\d{3,4})(?!\d)/gi,
        /\b(?:elo|rating|rated)\s*(?:<\s*=?|≤|(?:inferior(?:e)?\s*(?:a|to)?|max(?:imum)?|under)\s*)\s*(\d{3,4})(?!\d)/gi], 100, 3999);
}
export function seniorAges(text: string): number[] {
    const ages = numbers(text, [/\b(?:s\s*|over\s*|o)(50|60|65|70|75|80)(?!\d)(?:\+(?!\s*\d))?(?![+\w])/gi,
        /\b(50|60|65|70|75|80)\s*\+(?!\s*\d)/gi], 50, 80);
    return ages.length ? ages : SENIOR.test(text) ? [50] : [];
}
export function entryCategories(name: string, category = ''): EntryCategories {
    const ages = youthAges(name);
    const ratings = ratingCeilings(`${name} ${category}`);
    const namedSeniors = seniorAges(name);
    const youth = YOUTH.test(name) || ages.length > 0 || (!ratings.length && /\byouth\b/i.test(category));
    return { youth, ages: ages.length ? ages : youthAges(category), ratings,
        seniors: namedSeniors.length ? namedSeniors : seniorAges(category) };
}
/** Repair old generated tags while retaining source-only youth facts without an adult ceiling. */
export function normalizeEntryCategory(row: { name: string; category: string }): string {
    const entry = entryCategories(row.name, row.category);
    const tags = row.category.split(',').map(tag => tag.trim()).filter(tag =>
        tag && !/^(?:youth|u\d{1,4}|s\s*\d{2}\+?)$/i.test(tag));
    if (entry.youth) tags.push('Youth');
    tags.push(...entry.ages.map(age => `U${age}`), ...entry.seniors.map(age => `S${age}+`),
        ...entry.ratings.map(rating => `U${rating}`));
    return [...new Set(tags)].join(', ');
}
