const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const data = JSON.parse(fs.readFileSync('tournaments_data.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const originalConsole = console;
let passed = 0;
function check(name, fn) { fn(); passed++; originalConsole.log(`PASS ${name}`); }
function stripScriptElements(inputHtml) {
  const parsed = new JSDOM(inputHtml);
  for (const scriptEl of parsed.window.document.querySelectorAll('script')) scriptEl.remove();
  return parsed.window.document.documentElement?.outerHTML || parsed.serialize();
}
async function verify(width) {
  const dom = new JSDOM(stripScriptElements(html), { url: 'https://example.test/?open=0&excludeYouth=0&team=1&long=1', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w, 'innerWidth', { value: width });
  w.matchMedia = query => ({ matches: /max-width/.test(query) ? width <= Number(query.match(/(\d+)px/)?.[1] || 1023) : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  w.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const registered = new Map();
  Object.defineProperty(w.document, 'modelContext', { value: { registerTool(tool) { registered.set(tool.name, tool); } } });
  for (const key of ['window','document','location','history','localStorage','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','Element','Node','Event','KeyboardEvent','MouseEvent','HTMLDialogElement','MutationObserver']) global[key] = key === 'window' ? w : w[key];
  global.getComputedStyle = w.getComputedStyle.bind(w);
  global.requestAnimationFrame = w.requestAnimationFrame.bind(w);
  global.cancelAnimationFrame = w.cancelAnimationFrame.bind(w);
  global.fetch = async url => {
    const file = path.basename(String(url));
    if (!['config.json','tournaments_data.json','tournaments_data_meta.json'].includes(file)) throw new Error(`Unexpected external fetch: ${url}`);
    return new Response(fs.readFileSync(file), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  for (const key of Object.keys(require.cache)) if (key.includes('/dist-verify/')) delete require.cache[key];
  console = { ...originalConsole, log() {}, debug() {}, info() {}, warn() {} };
  require('../dist-verify/app.js');
  await pause(100);
  const d = w.document;
  const cards = () => [...d.querySelectorAll('.tournament-card')];
  const change = (id, value) => { const el=d.getElementById(id); el.checked=value; el.dispatchEvent(new w.Event('change', {bubbles:true})); };
  const search = value => { const el=d.getElementById('quickSearch'); el.value=value; el.dispatchEvent(new w.Event('input', {bubbles:true})); };
  check(`${width}: initial real dataset renders`, () => assert(cards().length > 0));
  check(`${width}: index count is labeled separately`, () => { assert.match(d.getElementById('headerTournamentCount').textContent, /tournaments in index/); assert.match(d.getElementById('resultsCount').textContent, /found$/); });
  check(`${width}: useful chess facts shown`, () => assert(d.querySelector('.tournament-format')));
  check(`${width}: time controls outside mobile sheet`, () => assert(!d.getElementById('filtersSheet').contains(d.getElementById('classicalTime'))));
  search('Vienna');
  check(`${width}: search finds displayed city`, () => { assert(cards().length > 0); assert(cards().every(card=>/vienna/i.test(card.textContent))); });
  search('Slovakia');
  check(`${width}: search finds country name`, () => { assert(cards().length > 0); assert(cards().every(card=>/Slovakia/.test(card.textContent))); });
  search('');
  change('rapidTime',false); change('blitzTime',false);
  await pause(20);
  check(`${width}: Classical selection and URL agree`, () => { assert.match(w.location.search,/tc=classical/); assert(cards().every(card=>card.querySelector('.time-control-class--classical'))); });
  change('classicalTime',false);
  await pause(20);
  check(`${width}: all-off is explicit all-tempos`, () => { assert(['classicalTime','rapidTime','blitzTime'].every(id=>d.getElementById(id).checked)); assert.equal(d.getElementById('allTimeControls').getAttribute('aria-pressed'),'true'); assert(!d.getElementById('activeFilterChips').textContent.includes('No time control')); });
  const portugal = d.querySelector('input[name="countryFilter"][value="POR"]');
  portugal.checked=true; portugal.dispatchEvent(new w.Event('change',{bubbles:true}));
  await pause(20);
  check(`${width}: country filter excludes venue substring matches`, () => { assert(cards().length > 0); for(const card of cards()) { const source=data.find(t=>t.url===card.dataset.tournamentUrl); assert.equal(source.location.split(',').pop().trim(),'POR'); } });
  portugal.checked=false; portugal.dispatchEvent(new w.Event('change',{bubbles:true}));
  await pause(20);
  cards()[0].querySelector('.shortlist-btn').click();
  check(`${width}: shortlist saves`, () => assert(w.localStorage.getItem('medtourney_shortlist')?.includes(cards()[0].dataset.tournamentUrl)));
  cards()[0].querySelector('.tournament-link').click();
  check(`${width}: details open`, () => assert(d.getElementById('tournamentDetail').open));
  d.querySelector('.detail-close').click();
  await pause(20);
  if(width<1024) {
    d.getElementById('openFiltersBtn').click();
    check(`${width}: mobile filter sheet opens`, () => assert(d.body.classList.contains('sheet-open')));
    d.querySelector('.sheet-close').click();
    check(`${width}: mobile filter sheet closes`, () => assert(!d.body.classList.contains('sheet-open')));
    check(`${width}: quick modes moved outside sheet`, () => assert(d.getElementById('mobileQuickFilters').querySelector('.mode-switch')));
  }
  check(`${width}: tools registered in API harness`, () => assert.equal(registered.size,2));
  const setTool = registered.get('set_time_controls');
  const result = setTool.execute({timeControls:['blitz']});
  check(`${width}: tool and UI share state`, () => { assert.deepEqual(result.timeControls,['blitz']); assert.match(w.location.search,/tc=blitz/); assert(cards().every(card=>card.querySelector('.time-control-class--blitz'))); });
  check(`${width}: invalid tool input leaves state intact`, () => { assert.throws(()=>setTool.execute({timeControls:['bullet']})); assert.deepEqual(registered.get('read_visible_tournaments').execute({}).timeControls,['blitz']); });
  w.close(); console=originalConsole;
}
(async()=>{
  for(const width of [1440,390,320]) await verify(width);
  const {safeValidateTournaments}=require('../dist-verify/utils/validators.js');
  const sample={...data[0],details:{rounds:7,system:'Swiss-System',homepage:'a street address'}};
  check('bad optional homepage retains valid round information',()=> { const v=safeValidateTournaments([sample]); assert(v.success); assert.equal(v.data[0].details.rounds,7); assert.equal(v.data[0].details.homepage,undefined); });
  const {UIManager}=require('../dist-verify/services/UIManager.js');
  const ui=new UIManager();
  check('month grouping uses UTC across time zones',()=>assert.equal(ui.monthKey(new Date('2026-11-01T00:00:00Z')),'2026-10'));
  for(const file of ['index.html','config.json','tournaments_data.json','tournaments_data_meta.json']) check(`deploy asset ${file}`,()=>assert(fs.existsSync(path.join('dist',file))));
  originalConsole.log(`${passed} checks passed. DOM interaction tests at 1440, 390 and 320 px; this harness does not measure browser layout.`);
})().catch(error=>{console=originalConsole; originalConsole.error(error);process.exitCode=1;});
