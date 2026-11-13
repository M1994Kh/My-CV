/* IELTS Studio · 30-Day Plan
   Morning: Cambridge IELTS assessments (one skill a day for 20 days, then ten full tests).
   Afternoon: English Collocations in Use, two units a day.
   The books stay on the learner's device (see "My books"); nothing from them is stored in this site. */
(function () {
'use strict';
const { $, store, esc } = IS;
const D = window.PLAN_DATA;
const root = $('planApp');
const SK = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };
const MINS = { L: 32, R: 60, W1: 20, W2: 40 };
let P = store.get('plan', null);
const save = () => store.set('plan', P);
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dayDate = n => { const d = new Date(P.start + 'T00:00:00'); d.setDate(d.getDate() + n - 1); return d };
const nice = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const todayN = () => Math.floor((new Date(iso(new Date()) + 'T00:00:00') - new Date(P.start + 'T00:00:00')) / 864e5) + 1;
const clampDay = n => Math.max(1, Math.min(30, n));
const rec = n => (P.days[n] = P.days[n] || {});
const half = x => Math.floor(x * 2 + 0.5) / 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normA = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();

/* ---------- schedule ---------- */
function testAt(i) { const b = P.books, k = i % (b.length * 4); return { book: b[Math.floor(k / 4)], test: k % 4 + 1 } }
function dayPlan(n) {
  const co = D.collo[n - 1];
  if (n <= 20) return { n, kind: 'single', skills: ['LRWS'[(n - 1) % 4]], t: testAt(Math.floor((n - 1) / 4)), co };
  return { n, kind: 'full', skills: ['L', 'R', 'W', 'S'], t: testAt(5 + n - 21), co };
}
const testName = t => `Cambridge IELTS ${t.book}, Test ${t.test}`;
function dayDone(n) { const d = P.days[n]; return !!(d && d.report) }
function bandFor(k, raw) { for (const [min, b] of D.bands[k]) if (raw >= min) return b; return 0 }

/* ---------- weaknesses and reports ---------- */
function buildReport(n) {
  const p = dayPlan(n), d = rec(n), weak = [], bands = {}, lines = [];
  for (const k of ['L', 'R']) {
    const r = d[k]; if (!r || r.raw == null) continue;
    bands[k] = r.band;
    const secs = D.sections[k].map(([name, a, b]) => { const w = (r.wrong || []).filter(q => q >= a && q <= b).length, tot = b - a + 1; return { name, right: tot - w, tot } });
    lines.push(`${SK[k]}: ${r.raw}/40, band ${r.band.toFixed(1)} (${secs.map(s => `${s.name} ${s.right}/${s.tot}`).join(', ')})`);
    secs.filter(s => s.right / s.tot < 0.6).forEach(s => weak.push({ skill: k, text: `${SK[k]} ${s.name}: only ${s.right}/${s.tot} correct` }));
    const cnt = {}; Object.values(r.causes || {}).forEach(c => { if (c) cnt[c] = (cnt[c] || 0) + 1 });
    Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([c, m]) => weak.push({ skill: k, text: `${SK[k]}: ${c}`, count: m }));
  }
  for (const k of ['W', 'S']) {
    const r = d[k]; if (!r || (r.band == null && !(r.weak || []).length)) continue;
    if (r.band != null) { bands[k] = r.band; lines.push(`${SK[k]}: band ${Number(r.band).toFixed(1)}${r.crit ? ' (' + Object.entries(r.crit).map(([c, v]) => `${c} ${v}`).join(', ') + ')' : ''}`) }
    (r.weak || []).forEach(w => weak.push({ skill: k, text: `${SK[k]}: ${w}` }));
  }
  const c = d.C;
  if (c && c.total) lines.push(`Collocations (Units ${p.co.units.join(' and ')}): ${c.score}/${c.total}`);
  const got = Object.values(bands);
  const overall = ['L', 'R', 'W', 'S'].every(k => bands[k] != null) ? half(got.reduce((a, b) => a + b, 0) / 4) : null;
  return { n, date: iso(dayDate(n)), kind: p.kind, test: testName(p.t), skills: p.skills, units: p.co.units, topic: p.co.topic, bands, overall, lines, weak,
    missed: (c && c.missed) || [], fixes: [].concat((d.W && d.W.fixes) || [], (d.S && d.S.fixes) || []), notes: d.notes || '', made: Date.now() };
}
function focusFor(n) {
  const cnt = new Map();
  let used = 0;
  for (let i = n - 1; i >= 1 && used < 5; i--) {
    const r = P.days[i] && P.days[i].report; if (!r) continue; used++;
    r.weak.forEach(w => cnt.set(w.text.replace(/: only \d+\/\d+ correct/, ''), (cnt.get(w.text.replace(/: only \d+\/\d+ correct/, '')) || 0) + (w.count || 1)));
  }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, c]) => ({ text: t, count: c }));
}
const loaded = {};
function loadScript(src) { return loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src + '. Check your connection and try again.')) }; document.head.appendChild(s) })) }
const latin = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '?');
async function reportPDF(r) {
  await loadScript('vendor/jspdf.umd.min.js');
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  const W = 595, M = 48; let y = 44;
  const need = h => { if (y + h > 790) { doc.addPage(); y = 44 } };
  const text = (t, size, style, color, gap) => { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || [22, 35, 61])); doc.splitTextToSize(latin(t), W - 2 * M).forEach(l => { need(size + 5); y += size; doc.text(l, M, y); y += 5 }); y += gap || 0 };
  const head = t => { y += 8; need(30); text(t.toUpperCase(), 9, 'bold', [39, 71, 214], 2); doc.setDrawColor(221, 227, 236); doc.line(M, y - 4, W - M, y - 4); y += 6 };
  const list = arr => arr.forEach(t => text('-  ' + t, 11, 'normal', null, 1));
  text('IELTS Studio  |  30-Day Plan', 9, 'bold', [93, 106, 130], 4);
  text(`Day ${r.n} report`, 24, 'bold', null, 2);
  text(`${nice(new Date(r.date + 'T00:00:00'))} ${r.date.slice(0, 4)}   |   Morning: ${r.kind === 'full' ? 'full test' : SK[r.skills[0]]}, ${r.test}   |   Afternoon: Collocations Units ${r.units.join(' and ')}`, 10, 'normal', [93, 106, 130], 6);
  head('Results');
  if (r.overall != null) text(`Overall band (average of four skills): ${r.overall.toFixed(1)}`, 13, 'bold', null, 2);
  r.lines.length ? list(r.lines) : text('No scores were recorded for this day.', 11);
  head('Weaknesses found today');
  r.weak.length ? list(r.weak.map(w => w.text + (w.count > 1 ? `  (x${w.count})` : ''))) : text('None recorded.', 11);
  if (r.fixes.length) { head('How to fix them'); list(r.fixes) }
  head('Collocations to review');
  r.missed.length ? list(r.missed) : text('No collocations missed.', 11);
  if (r.notes) { head('My notes'); text(r.notes, 11) }
  head('Focus for the next sessions');
  const f = focusFor(r.n + 1);
  f.length ? list(f.map(x => x.text + (x.count > 1 ? `  (seen ${x.count} times)` : ''))) : text('Keep the same routine tomorrow.', 11);
  doc.save(`IELTS-Day-${pad(r.n)}-report-${r.date}.pdf`);
}

/* ---------- local book library (IndexedDB on this device only) ---------- */
const mem = new Map();
function idb() { return new Promise((res, rej) => { const q = indexedDB.open('ielts-books', 1); q.onupgradeneeded = () => q.result.createObjectStore('files', { keyPath: 'name' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) }) }
async function tx(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('files', mode), q = fn(t.objectStore('files')); t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error) }) }
async function bookList() { let saved = []; try { saved = await tx('readonly', s => s.getAll()) || [] } catch (e) {} const names = new Set(saved.map(f => f.name)); return saved.concat([...mem.values()].filter(f => !names.has(f.name))).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) }
async function bookAdd(files) { let kept = 0, temp = 0; for (const f of files) { const item = { name: f.name, type: f.type, size: f.size, blob: f }; try { await tx('readwrite', s => s.put(item)); kept++ } catch (e) { mem.set(f.name, item); temp++ } } return { kept, temp } }
async function bookDel(name) { mem.delete(name); try { await tx('readwrite', s => s.delete(name)) } catch (e) {} }
let viewURL = null;
async function renderBooks() {
  const box = $('plBooks'); if (!box) return;
  const files = await bookList();
  box.innerHTML = files.length ? files.map(f => `<div class="pl-file"><span title="${esc(f.name)}">${esc(f.name)}</span><span class="meta" style="flex:none">${(f.size / 1048576).toFixed(1)} MB</span><button type="button" class="linkbtn" data-act="bookOpen" data-name="${esc(f.name)}">Open</button><button type="button" class="linkbtn" data-act="bookDel" data-name="${esc(f.name)}">Remove</button></div>`).join('')
    : '<p class="meta" style="margin:0">No files yet. Add the Cambridge IELTS PDFs and audio and your Collocations PDF from this device.</p>';
}
async function openBook(name) {
  const f = (await bookList()).find(x => x.name === name); if (!f) return;
  if (viewURL) URL.revokeObjectURL(viewURL);
  viewURL = URL.createObjectURL(f.blob);
  const v = $('plView'), audio = /^audio\//.test(f.type) || /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name);
  v.innerHTML = `<div class="row"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</b><a class="btn btn-ghost" href="${viewURL}" target="_blank" rel="noopener">Open in a new tab</a><button type="button" class="btn btn-ghost" data-act="bookClose">Close</button></div>`
    + (audio ? `<audio controls preload="metadata" src="${viewURL}"></audio>` : `<iframe src="${viewURL}" title="${esc(f.name)}"></iframe><p class="meta" style="margin:0">If the page stays blank (some phones cannot show a PDF inside a page), use “Open in a new tab”.</p>`);
  v.hidden = false; v.scrollIntoView({ block: 'nearest' });
}
const booksHTML = () => `<section class="sheet"><details class="pl-d" id="plBooksD"${store.get('plBooksOpen', true) ? ' open' : ''}><summary>My books <span class="meta" style="font-weight:400">· kept on this device only</span></summary>
  <p class="meta" style="margin:0 0 10px">The test papers, audio and the collocations book are opened from your own files. They are saved inside this browser so you add them once per device; they are never uploaded.</p>
  <div class="pl-files" id="plBooks"></div>
  <div class="row" style="margin-top:10px"><label class="btn btn-ghost" style="cursor:pointer">＋ Add PDF or audio files<input type="file" id="plBookIn" multiple accept=".pdf,application/pdf,audio/*,.mp3,.m4a" hidden></label><span class="status" id="plBookSt" role="status"></span></div>
  </details><div class="pl-view" id="plView" hidden style="display:flex;flex-direction:column;gap:10px"></div></section>`;

/* ---------- timers ---------- */
const timers = {};
function timerHTML(key, mins) { const t = timers[key] || (timers[key] = { left: mins * 60, total: mins * 60, on: false }); return `<div class="pl-timer"><span class="pl-clock${t.left <= 0 ? ' over' : ''}" id="tm_${key}">${IS.fmt(t.left)}</span><button type="button" class="btn btn-ghost" data-act="timer" data-key="${key}">${t.on ? 'Pause' : 'Start timer'}</button><button type="button" class="linkbtn" data-act="timerReset" data-key="${key}">Reset</button><span class="meta">${mins} minutes</span></div>` }
function tick(key) { const t = timers[key], el = $('tm_' + key); if (!t.on) return; t.left = Math.max(0, t.total - Math.round((Date.now() - t.t0) / 1000) - t.used); if (el) { el.textContent = IS.fmt(t.left); el.classList.toggle('over', t.left <= 0) } if (t.left <= 0) { stopTimer(key); if (navigator.vibrate) try { navigator.vibrate([300, 150, 300]) } catch (e) {} const b = root.querySelector(`[data-act="timer"][data-key="${key}"]`); if (b) b.textContent = 'Time is up' } }
function stopTimer(key) { const t = timers[key]; if (!t) return; if (t.on) t.used = t.total - t.left; t.on = false; clearInterval(t.iv) }
function stopAllTimers() { Object.keys(timers).forEach(stopTimer) }

/* ---------- views ---------- */
let view = { name: 'home', n: 0 };
function setupHTML() {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const pick = new Set(store.get('planBooksDraft', [16, 17, 18, 19]));
  return `<section class="sheet"><div><div class="eyebrow">30-Day Plan · set-up</div><h2>Build your 30 days</h2></div>
  <p class="meta" style="margin:0">Mornings are for a timed Cambridge IELTS assessment, because your real test is in the morning. Afternoons are for two units of English Collocations in Use. Days 1–20 test one skill a day; days 21–30 are full four-skill tests.</p>
  <div class="grid"><div class="field"><label for="plStart">Day 1 is</label><input type="date" class="txtin" id="plStart" value="${iso(tomorrow)}"></div></div>
  <div class="field"><label>Which Cambridge IELTS Academic books do you have? <span class="meta">Fifteen tests are needed, so pick four or more.</span></label>
  <div class="presets" id="plBookPick">${Array.from({ length: 17 }, (_, i) => i + 4).map(b => `<button type="button" class="chip" data-act="pickBook" data-b="${b}" aria-pressed="${pick.has(b)}">${b}</button>`).join('')}</div></div>
  <div class="row"><button type="button" class="btn btn-primary" data-act="create">Create my plan</button><label class="btn btn-ghost" style="cursor:pointer">Restore a backup<input type="file" id="plRestore" accept=".json,application/json" hidden></label><span class="status" id="plSetupSt" role="status"></span></div></section>`;
}
function tagOf(p) { return p.kind === 'full' ? 'FULL TEST' : SK[p.skills[0]] }
function homeHTML() {
  const t = todayN(), cur = clampDay(t), done = Array.from({ length: 30 }, (_, i) => i + 1).filter(dayDone).length;
  const p = dayPlan(cur), f = focusFor(cur);
  const lead = t < 1 ? `Your plan starts on ${nice(dayDate(1))}.` : t > 30 ? 'The 30 days are over. Open any day to repeat it.' : `Today is Day ${t}.`;
  return `<section class="sheet"><div class="drillhead"><div><div class="eyebrow">30-Day Plan</div><h2>${lead}</h2></div><span class="lprog">${done} / 30 days reported</span></div>
  <div class="lbar" aria-hidden="true"><i style="width:${done / 30 * 100}%"></i></div>
  <div class="pl-shift">Morning</div><div class="pl-task"><b>${tagOf(p)}</b> · ${testName(p.t)}${p.kind === 'full' ? ' · Listening, Reading, Writing, then Speaking' : ''}</div>
  <div class="pl-shift">Afternoon</div><div class="pl-task"><b>Collocations Units ${p.co.units.join(' and ')}</b> · ${esc(p.co.topic)}</div>
  ${f.length ? `<div><div class="eyebrow">Focus from your last reports</div><ul class="pl-list" style="margin-top:6px">${f.map(x => `<li>${esc(x.text)}${x.count > 1 ? ` <span class="meta">×${x.count}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
  <div class="row"><a class="btn btn-primary" href="#plan/day/${cur}">Open Day ${cur}</a><a class="btn btn-ghost" href="#plan/reports">Reports</a></div></section>
  <section class="sheet"><div><div class="eyebrow">Calendar</div><h2>All 30 days</h2></div>
  <div class="pl-days">${Array.from({ length: 30 }, (_, i) => { const n = i + 1, q = dayPlan(n); return `<a class="pl-day${n === t ? ' today' : ''}${dayDone(n) ? ' done' : ''}${q.kind === 'full' ? ' full' : ''}" href="#plan/day/${n}"><b>${n}</b><span>${nice(dayDate(n))}</span><em>${dayDone(n) ? '✓ ' : ''}${q.kind === 'full' ? 'Full' : SK[q.skills[0]]}</em><span>C${q.t.book}·T${q.t.test} U${q.co.units.join('–')}</span></a>` }).join('')}</div></section>
  <section class="sheet"><div><div class="eyebrow">Plan settings</div><h2>Books and backup</h2></div>
  <p class="meta" style="margin:0">Using Cambridge IELTS ${P.books.join(', ')} · started ${nice(dayDate(1))}. Your answers and reports live in this browser; download a backup to move them to another device.</p>
  <div class="row"><button type="button" class="btn btn-ghost" data-act="backup">Download backup</button><label class="btn btn-ghost" style="cursor:pointer">Restore a backup<input type="file" id="plRestore" accept=".json,application/json" hidden></label><button type="button" class="btn btn-ghost" data-act="reset">Start a new plan</button><span class="status" id="plSetupSt" role="status"></span></div></section>`;
}
function reportHTML(r) {
  return `<div class="pl-report"><h3>Day ${r.n} report · ${nice(new Date(r.date + 'T00:00:00'))}</h3>
  ${r.overall != null ? `<div class="pl-res"><div class="mtile"><b>${r.overall.toFixed(1)}</b><span>overall band</span></div>${['L', 'R', 'W', 'S'].map(k => `<div class="mtile"><b>${Number(r.bands[k]).toFixed(1)}</b><span>${SK[k]}</span></div>`).join('')}</div>` : ''}
  ${r.lines.length ? `<ul class="pl-list">${r.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="meta" style="margin:0">No scores recorded yet.</p>'}
  <div><div class="eyebrow">Weaknesses</div>${r.weak.length ? `<ul class="pl-list" style="margin-top:6px">${r.weak.map(w => `<li>${esc(w.text)}${w.count > 1 ? ` <span class="meta">×${w.count}</span>` : ''}</li>`).join('')}</ul>` : '<p class="meta" style="margin:4px 0 0">None recorded.</p>'}</div>
  ${r.fixes.length ? `<div><div class="eyebrow">How to fix them</div><ul class="pl-list" style="margin-top:6px">${r.fixes.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
  ${r.missed.length ? `<div><div class="eyebrow">Collocations to review</div><p style="margin:4px 0 0">${r.missed.map(esc).join(' · ')}</p></div>` : ''}
  <div class="row"><button type="button" class="btn btn-primary" data-act="pdf" data-n="${r.n}">Download PDF</button><span class="status" id="plPdfSt${r.n}" role="status"></span></div></div>`;
}
function reportsHTML() {
  const rs = Array.from({ length: 30 }, (_, i) => P.days[i + 1] && P.days[i + 1].report).filter(Boolean);
  const trend = k => rs.filter(r => r.bands[k] != null).map(r => `D${r.n}: ${Number(r.bands[k]).toFixed(1)}`).join(' · ');
  return `<section class="sheet"><div class="drillhead"><div><div class="eyebrow">30-Day Plan</div><h2>Daily reports</h2></div><a href="#plan" class="linkbtn">← Calendar</a></div>
  ${rs.length ? `<div>${['L', 'R', 'W', 'S'].filter(trend).map(k => `<p class="meta" style="margin:0 0 4px"><b>${SK[k]}</b> ${trend(k)}</p>`).join('')}</div>` + rs.slice().reverse().map(reportHTML).join('') : '<p class="meta" style="margin:0">No reports yet. Finish a day and press “Build today’s report”.</p>'}</section>`;
}

/* --- day view --- */
function lrHTML(n, k, p) {
  const r = rec(n)[k] || {}, ans = r.answers || [], wrong = new Set(r.wrong || []), causes = r.causes || {};
  const rows = D.sections[k].map(([name, a, b]) => `<div class="pl-sec">${name}</div>` + Array.from({ length: b - a + 1 }, (_, i) => { const q = a + i, w = wrong.has(q);
    return `<div class="pl-q"><label for="a_${k}${q}">${q}</label><input id="a_${k}${q}" data-ans="${k}" data-q="${q}" value="${esc(ans[q] || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" data-act="wrong" data-k="${k}" data-q="${q}" aria-pressed="${w}" aria-label="Mark question ${q} wrong" title="Mark wrong">✗</button>${w ? `<select data-cause="${k}" data-q="${q}" aria-label="Why question ${q} was wrong"><option value="">Why was it wrong?</option>${D.causes[k].map(c => `<option${causes[q] === c ? ' selected' : ''}>${c}</option>`).join('')}</select>` : ''}</div>` }).join('')).join('');
  return `<section class="sheet" id="sk_${k}"><div><div class="eyebrow">Morning · ${SK[k]}</div><h2>${testName(p.t)}</h2></div>
  <div class="pl-task">${k === 'L' ? 'Open the Listening section of this test and its four audio parts from <b>My books</b>. Play each part once only, as in the real test, and type your answers below as you listen.' : 'Open the three Reading passages of this test from <b>My books</b>. One hour for all 40 questions, with no extra transfer time.'}</div>
  ${timerHTML(k + n, MINS[k])}
  <div class="pl-ans">${rows}</div>
  <p class="meta" style="margin:0">When the time is up, check the answer key at the back of your book, tap ✗ on each wrong answer, and choose why it went wrong.</p>
  <div class="row"><button type="button" class="btn btn-primary" data-act="score" data-k="${k}">Score this test</button></div>
  <div id="res_${k}">${r.raw != null ? lrResult(k, r) : ''}</div></section>`;
}
function lrResult(k, r) {
  return `<div class="pl-res"><div class="mtile"><b>${r.raw}/40</b><span>raw score</span></div><div class="mtile"><b>${r.band.toFixed(1)}</b><span>approximate band</span></div>${D.sections[k].map(([name, a, b]) => { const w = (r.wrong || []).filter(q => q >= a && q <= b).length, tot = b - a + 1; return `<div class="mtile"><b>${tot - w}/${tot}</b><span>${name}</span></div>` }).join('')}</div>`;
}
const wc = t => (String(t || '').trim().match(/\S+/g) || []).length;
function manualHTML(k, r) {
  return `<details class="pl-d"><summary>Enter a result yourself</summary><p class="meta" style="margin:0 0 8px">Use this if another AI or a teacher marked you. One weakness per line.</p>
  <div class="row"><label for="mb_${k}">Band</label><input type="number" class="pl-num" id="mb_${k}" min="0" max="9" step="0.5" value="${r.band != null ? r.band : ''}"></div>
  <textarea class="pl-small" id="mw_${k}" placeholder="e.g. Articles missing before singular nouns" style="margin-top:8px">${esc((r.weak || []).join('\n'))}</textarea>
  <div class="row" style="margin-top:8px"><button type="button" class="btn btn-ghost" data-act="manual" data-k="${k}">Save result</button></div></details>`;
}
function aiResult(r) {
  if (r.band == null && !(r.weak || []).length) return '';
  return `<div class="pl-res">${r.band != null ? `<div class="mtile"><b>${Number(r.band).toFixed(1)}</b><span>band</span></div>` : ''}${r.crit ? Object.entries(r.crit).map(([c, v]) => `<div class="mtile"><b>${v}</b><span>${esc(c)}</span></div>`).join('') : ''}</div>
  ${(r.weak || []).length ? `<div><div class="eyebrow" style="margin-top:8px">Weaknesses</div><ul class="pl-list" style="margin-top:6px">${r.weak.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
  ${(r.fixes || []).length ? `<div><div class="eyebrow" style="margin-top:8px">Next time</div><ul class="pl-list" style="margin-top:6px">${r.fixes.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}`;
}
function wHTML(n, p) {
  const r = rec(n).W || {};
  const task = (i, min, target) => `<div class="pl-shift">Task ${i} · ${min} minutes · at least ${target} words</div>
  <textarea class="pl-small" data-w="p${i}" placeholder="Type or paste the Task ${i} question from your book (needed for AI marking)">${esc(r['p' + i] || '')}</textarea>
  ${timerHTML('W' + i + n, min)}
  <textarea class="pl-essay" data-w="t${i}" placeholder="Write your Task ${i} answer here" spellcheck="false">${esc(r['t' + i] || '')}</textarea>
  <span class="pl-wc${wc(r['t' + i]) >= target ? ' ok' : ''}" id="wc${i}" data-target="${target}">${wc(r['t' + i])} words</span>`;
  return `<section class="sheet" id="sk_W"><div><div class="eyebrow">Morning · Writing</div><h2>${testName(p.t)}</h2></div>
  <div class="pl-task">Open the Writing page of this test from <b>My books</b>. Do Task 1, then Task 2, without a break: 60 minutes in total.</div>
  ${task(1, MINS.W1, 150)}${task(2, MINS.W2, 250)}
  <div class="row"><button type="button" class="btn btn-primary" data-act="markW">Mark with Gemini</button><button type="button" class="btn btn-ghost" data-act="copyW">Copy for another AI</button><span class="status" id="wSt" role="status"></span></div>
  <div id="res_W">${aiResult(r)}</div>${manualHTML('W', r)}</section>`;
}
function sHTML(n, p) {
  const r = rec(n).S || {};
  return `<section class="sheet" id="sk_S"><div><div class="eyebrow">Morning · Speaking</div><h2>${testName(p.t)}</h2></div>
  <div class="pl-task">Open the Speaking page of this test from <b>My books</b>. Paste its questions below if you want the live examiner to ask exactly those; leave it empty and the examiner chooses typical Academic topics.</div>
  <textarea class="pl-small" data-s="q" placeholder="Optional: Part 1 questions, the Part 2 cue card and Part 3 questions from your book">${esc(r.q || '')}</textarea>
  <div class="pl-shift">Option A · Live examiner (Gemini Live)</div>
  <p class="meta" style="margin:0">A spoken, real-time Part 1–3 interview using your Gemini key from Settings. Wear headphones so the examiner’s voice is not recorded as yours. Your side is recorded and given back as an MP3.</p>
  <div class="row"><button type="button" class="btn btn-primary" data-act="liveStart">Start live test</button><button type="button" class="btn btn-ghost" data-act="liveStop" hidden>End test</button><span class="status" id="liveSt" role="status"></span></div>
  <details class="pl-d"><summary class="meta">Live model</summary><input type="text" class="txtin" id="liveModel" spellcheck="false" placeholder="Chosen automatically from your key" value="${esc(store.get('liveModel', ''))}"><p class="meta" style="margin:6px 0 0">Leave empty to pick the newest Live model your key can use.</p></details>
  <div class="pl-log" id="liveLog" hidden></div>
  <div class="pl-shift">Option B · Voice recorder → MP3</div>
  <p class="meta" style="margin:0">Record yourself answering the questions, then download the MP3 and upload it to any AI you like for feedback.</p>
  <div class="row"><button type="button" class="btn btn-primary" data-act="recStart">● Record</button><button type="button" class="btn btn-ghost" data-act="recPause" hidden>Pause</button><button type="button" class="btn btn-ghost" data-act="recStop" hidden>Stop and make MP3</button><span class="pl-clock" id="recClock" hidden>0:00</span><div class="pl-meter" id="recMeter" hidden><i></i></div></div>
  <div class="status" id="recSt" role="status"></div>
  <div id="takes" style="display:flex;flex-direction:column;gap:8px"></div>
  <div class="row"><button type="button" class="btn btn-ghost" data-act="copyS">Copy prompt for another AI</button><a class="btn btn-ghost" href="#speaking">Open the Studio examiner</a></div>
  <div class="status" id="sSt" role="status"></div>
  <div id="res_S">${aiResult(r)}</div>${manualHTML('S', r)}</section>`;
}
function cHTML(n, p) {
  const c = rec(n).C || {};
  return `<section class="sheet" id="sk_C"><div><div class="eyebrow">Afternoon · Collocations</div><h2>Units ${p.co.units.join(' and ')}</h2></div>
  <div class="pl-task"><b>Step 1 · Read.</b> Study Units ${p.co.units.join(' and ')} of English Collocations in Use in <b>My books</b> and do the exercises on the facing pages (about 40 minutes). Topic: ${esc(p.co.topic)}.</div>
  <div class="pl-task"><b>Step 2 · Learn these eight.</b> Say each one aloud in a sentence about your own life.</div>
  <div class="pl-tut" id="plTut">${p.co.items.map(([cl, , , m]) => `<div><b>${esc(cl)}</b><span>${esc(m)}</span></div>`).join('')}</div>
  <div class="pl-task"><b>Step 3 · Practise.</b> Fill the gap from memory. Collocations you missed on earlier days come back here.</div>
  <div class="row"><button type="button" class="btn btn-primary" data-act="quiz">${c.total ? 'Practise again' : 'Start practice'}</button><button type="button" class="btn btn-ghost" data-act="quizAI">More sentences from Gemini</button><span class="status" id="cSt" role="status"></span></div>
  <div id="quizBox"></div>
  <div id="res_C">${c.total ? cResult(c) : ''}</div></section>`;
}
const cResult = c => `<div class="pl-res"><div class="mtile"><b>${c.score}/${c.total}</b><span>last practice</span></div></div>${c.missed.length ? `<p style="margin:8px 0 0"><span class="eyebrow">To review</span><br>${c.missed.map(esc).join(' · ')}</p>` : '<p class="meta" style="margin:8px 0 0">Nothing missed.</p>'}`;
function dayHTML(n) {
  const p = dayPlan(n), d = rec(n), f = focusFor(n);
  return `<section class="sheet"><div class="drillhead"><div><div class="eyebrow">Day ${n} of 30 · ${nice(dayDate(n))}</div><h2>${p.kind === 'full' ? 'Full four-skill test' : SK[p.skills[0]] + ' assessment'} + Collocations ${p.co.units.join('–')}</h2></div><a href="#plan" class="linkbtn">← Calendar</a></div>
  <p class="meta" style="margin:0">${p.kind === 'full' ? 'Sit it like the real morning: start at 9:00, Listening → Reading → Writing with no breaks (about 2 h 40), then Speaking.' : 'Start at 9:00, the time of your real test. One timed section, marked the same morning.'} Collocations after lunch.</p>
  ${f.length ? `<div><div class="eyebrow">Watch for these today</div><ul class="pl-list" style="margin-top:6px">${f.map(x => `<li>${esc(x.text)}${x.count > 1 ? ` <span class="meta">×${x.count}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
  <div class="row"><a class="btn btn-ghost" href="#plan/day/${clampDay(n - 1)}"${n === 1 ? ' hidden' : ''}>← Day ${n - 1}</a><a class="btn btn-ghost" href="#plan/day/${clampDay(n + 1)}"${n === 30 ? ' hidden' : ''}>Day ${n + 1} →</a></div></section>
  ${booksHTML()}
  ${p.skills.map(k => k === 'W' ? wHTML(n, p) : k === 'S' ? sHTML(n, p) : lrHTML(n, k, p)).join('')}
  ${cHTML(n, p)}
  <section class="sheet"><div><div class="eyebrow">End of day</div><h2>Daily report</h2></div>
  <textarea class="pl-small" id="plNotes" placeholder="Anything else to remember tomorrow (optional)">${esc(d.notes || '')}</textarea>
  <div class="row"><button type="button" class="btn btn-primary" data-act="finish">Build today’s report</button></div>
  <div id="plReport">${d.report ? reportHTML(d.report) : ''}</div></section>`;
}
function render() {
  stopAllTimers(); liveStop(true); recAbort(); quiz = null;
  if (!P) { root.innerHTML = setupHTML(); return }
  root.innerHTML = view.name === 'day' ? dayHTML(view.n) : view.name === 'reports' ? reportsHTML() : homeHTML();
  if (view.name === 'day') renderBooks();
}

/* ---------- collocation practice ---------- */
let quiz = null;
function startQuiz(extra) {
  const n = view.n, p = dayPlan(n);
  const today = p.co.items.map(([c, g, a, m]) => ({ c, g, a, m }));
  const missed = Object.keys(P.missed || {});
  const pool = [];
  for (let i = 0; i < n - 1; i++) D.collo[i].items.forEach(([c, g, a, m]) => { if (missed.includes(c)) pool.push({ c, g, a, m, review: true }) });
  pool.sort(() => Math.random() - 0.5);
  const items = (extra || today).concat(extra ? [] : pool.slice(0, 6)).sort(() => Math.random() - 0.5);
  quiz = { items, i: 0, score: 0, missed: [], checked: false, extra: !!extra };
  showQ();
}
function showQ() {
  const box = $('quizBox'), q = quiz.items[quiz.i];
  box.innerHTML = `<div class="pl-quiz"><div class="row"><span class="eyebrow">Question ${quiz.i + 1} of ${quiz.items.length}${q.review ? ' · review' : ''}</span><span class="spacer"></span><span class="meta">${quiz.score} correct</span></div>
  <p>${esc(q.g).replace('___', '<span class="gap">&nbsp;</span>')}</p><span class="meta">Meaning: ${esc(q.m)}</span>
  <div class="row"><input type="text" class="txtin" id="qIn" style="flex:1;min-width:140px" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Missing word" enterkeyhint="done"><button type="button" class="btn btn-primary" data-act="qCheck">Check</button><button type="button" class="linkbtn" data-act="qHint">First letter</button></div>
  <div class="pl-fb" id="qFb" role="status"></div></div>`;
  $('qIn').focus({ preventScroll: true });
  $('qIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); acts.qCheck() } };
}
function endQuiz() {
  const n = view.n, d = rec(n);
  P.missed = P.missed || {};
  quiz.items.forEach(q => { if (quiz.missed.includes(q.c)) P.missed[q.c] = (P.missed[q.c] || 0) + 1; else if (P.missed[q.c]) { P.missed[q.c]--; if (P.missed[q.c] <= 0) delete P.missed[q.c] } });
  if (!quiz.extra || !d.C) d.C = { score: quiz.score, total: quiz.items.length, missed: quiz.missed.slice() };
  else d.C.missed = [...new Set(d.C.missed.concat(quiz.missed))];
  save();
  $('quizBox').innerHTML = `<div class="pl-quiz"><p>${quiz.score} / ${quiz.items.length} correct</p>${quiz.missed.length ? `<span>Missed: <b>${quiz.missed.map(esc).join(' · ')}</b>. They will come back tomorrow.</span>` : '<span class="pl-fb good">All correct.</span>'}</div>`;
  $('res_C').innerHTML = cResult(d.C); quiz = null;
}

/* ---------- AI marking ---------- */
const STR = { type: 'string' }, NUM = { type: 'number' }, STRS = { type: 'array', items: STR };
const obj = p => ({ type: 'object', properties: p, required: Object.keys(p) });
const W_SCHEMA = obj({ overall: NUM, task1: obj({ band: NUM, task_achievement: NUM, coherence: NUM, lexical: NUM, grammar: NUM }), task2: obj({ band: NUM, task_response: NUM, coherence: NUM, lexical: NUM, grammar: NUM }), weaknesses: STRS, fixes: STRS });
const S_SCHEMA = obj({ overall: NUM, fluency: NUM, lexical: NUM, grammar: NUM, pronunciation: NUM, weaknesses: STRS, fixes: STRS });
const W_SYS = 'You are a strict, experienced IELTS Academic Writing examiner. Mark with the public band descriptors. Do not inflate scores. Task 2 counts double for the overall writing band; round to the nearest half band. Give at most six weaknesses, each one short, specific and quoted from the script where possible (for example: "Subject-verb agreement: \'the number of cars have\'"). Give at most five concrete fixes. Reply in JSON only.';
const S_SYS = 'You are a strict, experienced IELTS Speaking examiner. Mark with the public band descriptors for Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation. Do not inflate scores. Give at most six weaknesses, each short, specific and with an example from the candidate, and at most five concrete fixes. Reply in JSON only.';
function wText(r) { return `TASK 1 QUESTION:\n${r.p1 || '(not given)'}\n\nTASK 1 ANSWER (${wc(r.t1)} words):\n${r.t1 || '(not written)'}\n\nTASK 2 QUESTION:\n${r.p2 || '(not given)'}\n\nTASK 2 ANSWER (${wc(r.t2)} words):\n${r.t2 || '(not written)'}` }
async function markW() {
  const r = rec(view.n).W || {}, st = $('wSt');
  if (wc(r.t1) + wc(r.t2) < 50) { st.className = 'status err'; st.textContent = 'Write your answers first.'; return }
  st.className = 'status wait'; st.textContent = 'Gemini is marking your writing…';
  try {
    const out = await IS.gemini({ system: W_SYS, input: wText(r), schema: W_SCHEMA, onStatus: t => st.textContent = t });
    const j = IS.parseObj(out.text); if (!j) throw new Error('Gemini’s answer could not be read. Try again.');
    Object.assign(r, { band: half(j.overall), crit: { 'Task 1': j.task1 && j.task1.band, 'Task 2': j.task2 && j.task2.band, 'Coherence': j.task2 && j.task2.coherence, 'Lexical': j.task2 && j.task2.lexical, 'Grammar': j.task2 && j.task2.grammar }, weak: (j.weaknesses || []).slice(0, 6), fixes: (j.fixes || []).slice(0, 5) });
    rec(view.n).W = r; save(); $('res_W').innerHTML = aiResult(r); st.className = 'status ok'; st.textContent = `Marked by ${out.model}.`;
  } catch (e) { st.className = 'status err'; st.textContent = e.message }
}
async function assessS(take) {
  const n = view.n, r = rec(n).S = rec(n).S || {}, st = $('sSt');
  st.className = 'status wait'; st.textContent = 'Gemini is listening to your recording…';
  try {
    const input = [{ type: 'text', text: `IELTS Speaking test, candidate's audio attached (${IS.fmt(take.secs)} long).${r.q ? '\nQuestions used:\n' + r.q : ''}${take.transcript ? '\nTranscript of the interview:\n' + take.transcript : ''}` }, { type: 'audio', data: await IS.blobToB64(take.blob), mime_type: 'audio/mp3' }];
    const out = await IS.gemini({ system: S_SYS, input, schema: S_SCHEMA, timeout: 240000, onStatus: t => st.textContent = t });
    const j = IS.parseObj(out.text); if (!j) throw new Error('Gemini’s answer could not be read. Try again.');
    Object.assign(r, { band: half(j.overall), crit: { Fluency: j.fluency, Lexical: j.lexical, Grammar: j.grammar, Pronunciation: j.pronunciation }, weak: (j.weaknesses || []).slice(0, 6), fixes: (j.fixes || []).slice(0, 5) });
    save(); $('res_S').innerHTML = aiResult(r); st.className = 'status ok'; st.textContent = `Marked by ${out.model}.`;
  } catch (e) { st.className = 'status err'; st.textContent = e.message }
}
async function copy(text, st) { try { await navigator.clipboard.writeText(text); st.className = 'status ok'; st.textContent = 'Copied. Paste it into the other AI.' } catch (e) { st.className = 'status err'; st.textContent = 'Could not copy. Your browser blocked the clipboard.' } }

/* ---------- recorder and MP3 ---------- */
const takes = [];
let R = null;
async function toMp3(blob, onProg) {
  await loadScript('vendor/lame.min.js');
  const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); let buf;
  try { buf = await ctx.decodeAudioData(await blob.arrayBuffer()) } finally { try { ctx.close() } catch (e) {} }
  const rate = 22050, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(1, Math.max(1, Math.ceil(buf.duration * rate)), rate), src = off.createBufferSource();
  src.buffer = buf; src.connect(off.destination); src.start();
  const f = (await off.startRendering()).getChannelData(0);
  const enc = new window.lamejs.Mp3Encoder(1, rate, 48), out = [], step = 1152 * 20, pcm = new Int16Array(step);
  for (let i = 0, c = 0; i < f.length; i += step, c++) {
    const m = Math.min(step, f.length - i);
    for (let j = 0; j < m; j++) { const x = Math.max(-1, Math.min(1, f[i + j])); pcm[j] = x < 0 ? x * 0x8000 : x * 0x7FFF }
    const b = enc.encodeBuffer(m === step ? pcm : pcm.subarray(0, m)); if (b.length) out.push(new Uint8Array(b));
    if (c % 25 === 0) { if (onProg) onProg(i / f.length); await sleep(0) }
  }
  const end = enc.flush(); if (end.length) out.push(new Uint8Array(end));
  return { blob: new Blob(out, { type: 'audio/mpeg' }), secs: buf.duration };
}
function startCapture() {
  const mime = IS.pickMime(); let mr;
  try { mr = new MediaRecorder(IS.mic.stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : {}) } catch (e) { mr = new MediaRecorder(IS.mic.stream) }
  const chunks = []; mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) };
  mr.start(1000);
  return { mr, stop: () => new Promise(res => { if (mr.state === 'inactive') return res(new Blob(chunks, { type: mr.mimeType })); mr.onstop = () => res(new Blob(chunks, { type: mr.mimeType })); mr.stop() }) };
}
function recUI(on, paused) { const q = a => root.querySelector(`[data-act="${a}"]`); if (!q('recStart')) return; q('recStart').hidden = on; q('recPause').hidden = q('recStop').hidden = !on; q('recPause').textContent = paused ? 'Resume' : 'Pause'; $('recClock').hidden = $('recMeter').hidden = !on }
async function recStart() {
  const st = $('recSt');
  if (L) { st.className = 'status err'; st.textContent = 'End the live test first.'; return }
  if (!window.MediaRecorder) { st.className = 'status err'; st.textContent = 'This browser cannot record audio. Use Chrome, Edge or Safari.'; return }
  try { await IS.ensureMic() } catch (e) { st.className = 'status err'; st.textContent = e.message; return }
  R = { cap: startCapture(), secs: 0, paused: false };
  R.iv = setInterval(() => { if (!R.paused) { R.secs += 0.1; $('recClock') && ($('recClock').textContent = IS.fmt(R.secs)) } const m = root.querySelector('#recMeter i'); if (m) m.style.width = Math.min(100, IS.micLevel() * 500) + '%' }, 100);
  st.className = 'status'; st.innerHTML = '<span class="pl-rec"></span> Recording…'; recUI(true, false);
}
function recAbort() { if (!R) return; clearInterval(R.iv); try { R.cap.mr.stop() } catch (e) {} R = null; if (!L) IS.releaseMic() }
async function finishTake(webm, label, transcript, st) {
  st.className = 'status wait'; st.textContent = 'Making the MP3…';
  try {
    const { blob, secs } = await toMp3(webm, p => st.textContent = `Making the MP3… ${Math.round(p * 100)}%`);
    takes.push({ n: view.n, blob, secs, url: URL.createObjectURL(blob), label, transcript, name: `IELTS-Day${pad(view.n)}-Speaking-${label.replace(/\s+/g, '')}${takes.filter(t => t.n === view.n).length + 1}.mp3` });
    st.className = 'status ok'; st.textContent = 'MP3 ready. Download it now: recordings are not kept after you leave this page.'; renderTakes();
  } catch (e) { st.className = 'status err'; st.textContent = 'The recording could not be converted to MP3. ' + (e.message || '') }
}
async function recStop() {
  if (!R) return; const r = R; R = null; clearInterval(r.iv); recUI(false);
  const webm = await r.cap.stop(); IS.releaseMic();
  await finishTake(webm, 'take', '', $('recSt'));
}
function renderTakes() {
  const box = $('takes'); if (!box) return;
  box.innerHTML = takes.map((t, i) => t.n !== view.n ? '' : `<div class="pl-take"><div class="row"><b>${esc(t.name)}</b><span class="meta">${IS.fmt(t.secs)} · ${t.blob.size < 1048576 ? Math.round(t.blob.size / 1024) + ' KB' : (t.blob.size / 1048576).toFixed(1) + ' MB'}</span></div><audio controls preload="metadata" src="${t.url}"></audio><div class="row"><a class="btn btn-primary" href="${t.url}" download="${esc(t.name)}">Download MP3</a><button type="button" class="btn btn-ghost" data-act="assess" data-i="${i}">Assess with Gemini</button>${t.transcript ? `<button type="button" class="btn btn-ghost" data-act="copyT" data-i="${i}">Copy transcript</button>` : ''}</div></div>`).join('');
}

/* ---------- Gemini Live examiner ---------- */
let L = null;
const LIVE_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
async function liveModel(key) {
  const typed = ($('liveModel').value || '').trim(); store.set('liveModel', typed);
  if (typed) return typed.replace(/^models\//, '');
  try {
    const r = await fetch(IS.GEM_BASE + 'models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const j = await r.json();
    const ok = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('bidiGenerateContent')).map(m => m.name.replace(/^models\//, ''));
    const ver = s => { const m = s.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0 };
    ok.sort((a, b) => ver(b) - ver(a) || (/preview|exp/.test(a) ? 1 : 0) - (/preview|exp/.test(b) ? 1 : 0));
    if (ok[0]) return ok[0];
  } catch (e) {}
  return 'gemini-3.8-live';
}
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s) };
function down16(f, rate) { const ratio = rate / 16000, n = Math.floor(f.length / ratio), out = new Int16Array(n); for (let i = 0; i < n; i++) { const a = Math.floor(i * ratio), b = Math.min(f.length, Math.floor((i + 1) * ratio)); let s = 0; for (let j = a; j < b; j++) s += f[j]; const x = Math.max(-1, Math.min(1, s / Math.max(1, b - a))); out[i] = x < 0 ? x * 0x8000 : x * 0x7FFF } return out }
function logLine(who, text) { const log = $('liveLog'); if (!log) return; let last = log.lastElementChild; if (!last || last.dataset.who !== who) { last = document.createElement('div'); last.dataset.who = who; last.className = who === 'ex' ? 'ex' : ''; last.innerHTML = `<b>${who === 'ex' ? 'Examiner' : 'You'}</b><span></span>`; log.appendChild(last) } last.lastChild.textContent += text; log.scrollTop = log.scrollHeight }
function liveUI(on) { const a = root.querySelector('[data-act="liveStart"]'), b = root.querySelector('[data-act="liveStop"]'); if (a) { a.hidden = on; b.hidden = !on } }
async function liveStart() {
  const st = $('liveSt'), say = (t, k) => { st.className = 'status ' + (k || ''); st.textContent = t };
  if (R) return say('Stop the recorder first.', 'err');
  const key = IS.provCfg('gemini').key;
  if (!key) return say('Add your Gemini API key in Settings first.', 'err');
  if (!window.WebSocket || !window.MediaRecorder) return say('This browser cannot run the live test. Use Chrome, Edge or Safari.', 'err');
  say('Connecting…', 'wait');
  try { await IS.ensureMic() } catch (e) { return say(e.message, 'err') }
  const model = await liveModel(key), q = (rec(view.n).S || {}).q || '';
  const ctx = IS.mic.ctx, me = L = { ws: null, ready: false, t0: 0, next: 0, playing: [], lines: [], cap: null, model };
  $('liveLog').hidden = false; $('liveLog').innerHTML = ''; liveUI(true);
  const ws = me.ws = new WebSocket(LIVE_WS + '?key=' + encodeURIComponent(key));
  const sys = `You are an IELTS Speaking examiner running a complete, timed Academic IELTS Speaking test with one candidate. Speak clear, natural British English at normal examiner speed. Follow the real format exactly: greet the candidate and ask their name; Part 1 (4-5 minutes, about 10 short questions on two or three familiar topics); Part 2 (read the cue card aloud, give one minute of silent preparation, then let the candidate speak for up to two minutes and stop them politely at two minutes, then one rounding-off question); Part 3 (4-5 minutes of deeper discussion linked to Part 2). Ask one question at a time and wait for the answer. Never correct, praise, score or coach the candidate during the test, and do not explain the format. When Part 3 is finished say exactly: "Thank you. That is the end of the speaking test."${q ? '\nUse these questions from the candidate\'s practice book, in order:\n' + q : '\nChoose topics typical of recent Academic IELTS tests.'}`;
  ws.onopen = () => ws.send(JSON.stringify({ setup: { model: 'models/' + model, generationConfig: { responseModalities: ['AUDIO'] }, systemInstruction: { parts: [{ text: sys }] }, inputAudioTranscription: {}, outputAudioTranscription: {} } }));
  ws.onmessage = async ev => {
    if (L !== me) return;
    let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text()) } catch (e) { return }
    if (m.setupComplete) {
      me.ready = true; me.t0 = Date.now(); me.cap = startCapture();
      const src = ctx.createMediaStreamSource(IS.mic.stream), proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(); mute.gain.value = 0;
      proc.onaudioprocess = e => { if (L !== me || ws.readyState !== 1) return; ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64(new Uint8Array(down16(e.inputBuffer.getChannelData(0), ctx.sampleRate).buffer)), mimeType: 'audio/pcm;rate=16000' } } })) };
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination); me.nodes = [src, proc, mute];
      try { ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'The candidate has entered the room. Begin the test now.' }] }], turnComplete: true } })) } catch (e) {}
      say(`Live with ${model}. If the examiner stays silent, say “Hello”.`, 'ok');
      me.iv = setInterval(() => { if (Date.now() - me.t0 > 16 * 60000) liveStop() }, 5000);
      return;
    }
    const sc = m.serverContent; if (!sc) return;
    if (sc.interrupted) { me.playing.forEach(s => { try { s.stop() } catch (e) {} }); me.playing = []; me.next = 0 }
    if (sc.inputTranscription && sc.inputTranscription.text) logLine('you', sc.inputTranscription.text);
    if (sc.outputTranscription && sc.outputTranscription.text) logLine('ex', sc.outputTranscription.text);
    ((sc.modelTurn && sc.modelTurn.parts) || []).forEach(p => {
      const d = p.inlineData; if (!d || !d.data) return;
      const rate = +((d.mimeType || '').match(/rate=(\d+)/) || [0, 24000])[1], bin = atob(d.data), n = bin.length >> 1;
      const buf = ctx.createBuffer(1, n, rate), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); ch[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000 }
      const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination);
      const at = Math.max(ctx.currentTime + 0.03, me.next); s.start(at); me.next = at + buf.duration; me.playing.push(s); s.onended = () => { me.playing = me.playing.filter(x => x !== s) };
    });
  };
  ws.onerror = () => { if (L === me && !me.ready) say('Could not reach Gemini Live. It is blocked in some regions, so you may need a VPN.', 'err') };
  ws.onclose = ev => { if (L !== me) return; const why = ev.reason || (me.ready ? '' : 'The connection was refused (code ' + ev.code + ').'); liveStop(false, why ? `Gemini Live closed the session: ${why}${/model|not found|not supported/i.test(why) ? ' Type a Live model name from Google AI Studio under “Live model”.' : ''}` : '') };
}
async function liveStop(silent, err) {
  const me = L; if (!me) return; L = null;
  clearInterval(me.iv); try { me.ws.close() } catch (e) {}
  (me.nodes || []).forEach(x => { try { x.disconnect() } catch (e) {} }); me.playing.forEach(s => { try { s.stop() } catch (e) {} });
  liveUI(false);
  const st = $('liveSt'), log = $('liveLog');
  const transcript = log ? [...log.children].map(d => d.firstChild.textContent + ': ' + d.lastChild.textContent.trim()).join('\n') : '';
  const webm = me.cap ? await me.cap.stop() : null; IS.releaseMic();
  if (silent || !st) return;
  if (err) { st.className = 'status err'; st.textContent = err }
  if (webm && webm.size > 4000 && Date.now() - me.t0 > 5000) { if (transcript) { const r = rec(view.n).S = rec(view.n).S || {}; r.transcript = transcript; save() } await finishTake(webm, 'live', transcript, err ? $('recSt') : st) }
  else if (!err) { st.className = 'status'; st.textContent = 'Test ended.' }
}

/* ---------- actions ---------- */
const S_PROMPT = () => `${S_SYS.replace(' Reply in JSON only.', '')}\nI am attaching an MP3 of my IELTS Speaking practice test. Give me an overall band, a band for each of the four criteria, my main weaknesses with examples, and concrete fixes.${(rec(view.n).S || {}).q ? '\nQuestions I answered:\n' + rec(view.n).S.q : ''}`;
const acts = {
  pickBook(b) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); store.set('planBooksDraft', [...root.querySelectorAll('#plBookPick [aria-pressed="true"]')].map(x => +x.dataset.b)) },
  create() {
    const books = [...root.querySelectorAll('#plBookPick [aria-pressed="true"]')].map(x => +x.dataset.b), st = $('plSetupSt');
    if (!books.length) { st.className = 'status err'; st.textContent = 'Pick at least one book.'; return }
    if (!$('plStart').value) { st.className = 'status err'; st.textContent = 'Choose the date of Day 1.'; return }
    P = { v: 1, start: $('plStart').value, books, days: {}, missed: {} }; save(); render();
  },
  reset() { if (!confirm('Start a new plan? Your current answers and reports will be removed from this browser. Download a backup first if you want to keep them.')) return; P = null; store.set('plan', null); render() },
  backup() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'ielts-studio-plan', plan: P }, null, 1)], { type: 'application/json' })); a.download = `IELTS-30-day-plan-backup-${iso(new Date())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000) },
  timer(b) { const k = b.dataset.key, t = timers[k]; if (t.left <= 0) return; if (t.on) { stopTimer(k); b.textContent = 'Resume' } else { t.on = true; t.used = t.total - t.left; t.t0 = Date.now(); t.iv = setInterval(() => tick(k), 500); b.textContent = 'Pause' } },
  timerReset(b) { const k = b.dataset.key, t = timers[k]; stopTimer(k); t.left = t.total; t.used = 0; $('tm_' + k).textContent = IS.fmt(t.left); $('tm_' + k).classList.remove('over'); root.querySelector(`[data-act="timer"][data-key="${k}"]`).textContent = 'Start timer' },
  wrong(b) {
    const k = b.dataset.k, q = +b.dataset.q, r = rec(view.n)[k] = rec(view.n)[k] || {}; r.wrong = r.wrong || []; r.causes = r.causes || {};
    const on = !r.wrong.includes(q); if (on) r.wrong.push(q); else { r.wrong = r.wrong.filter(x => x !== q); delete r.causes[q] }
    b.setAttribute('aria-pressed', String(on)); const row = b.parentElement, old = row.querySelector('select'); if (old) old.remove();
    if (on) row.insertAdjacentHTML('beforeend', `<select data-cause="${k}" data-q="${q}" aria-label="Why question ${q} was wrong"><option value="">Why was it wrong?</option>${D.causes[k].map(c => `<option>${c}</option>`).join('')}</select>`);
    if (r.raw != null) { r.raw = 40 - r.wrong.length; r.band = bandFor(k, r.raw); $('res_' + k).innerHTML = lrResult(k, r) }
    save();
  },
  score(b) { const k = b.dataset.k, r = rec(view.n)[k] = rec(view.n)[k] || {}; r.wrong = r.wrong || []; r.raw = 40 - r.wrong.length; r.band = bandFor(k, r.raw); save(); $('res_' + k).innerHTML = lrResult(k, r) },
  manual(b) { const k = b.dataset.k, r = rec(view.n)[k] = rec(view.n)[k] || {}, v = parseFloat($('mb_' + k).value); r.band = isNaN(v) ? null : Math.max(0, Math.min(9, half(v))); r.weak = $('mw_' + k).value.split('\n').map(s => s.trim()).filter(Boolean); delete r.crit; save(); $('res_' + k).innerHTML = aiResult(r) },
  markW,
  copyW() { copy(W_SYS.replace(' Reply in JSON only.', '') + '\n\n' + wText(rec(view.n).W || {}), $('wSt')) },
  copyS() { copy(S_PROMPT(), $('sSt')) },
  copyT(b) { copy(takes[+b.dataset.i].transcript, $('sSt')) },
  assess(b) { assessS(takes[+b.dataset.i]) },
  recStart, recStop,
  recPause() { if (!R) return; R.paused = !R.paused; try { R.paused ? R.cap.mr.pause() : R.cap.mr.resume() } catch (e) {} recUI(true, R.paused); $('recSt').innerHTML = R.paused ? 'Paused.' : '<span class="pl-rec"></span> Recording…' },
  liveStart, liveStop() { liveStop() },
  quiz() { startQuiz() },
  async quizAI() {
    const st = $('cSt'), p = dayPlan(view.n);
    st.className = 'status wait'; st.textContent = 'Gemini is writing new sentences…';
    try {
      const out = await IS.gemini({ system: 'You write IELTS collocation gap-fill exercises. Reply in JSON only.', thinking: 'low',
        input: `Write one new, original gap-fill sentence at IELTS band 6-7 level for each of these collocations: ${p.co.items.map(i => i[0]).join('; ')}. In each sentence replace exactly one word of the collocation with ___ and give that word, in the form the sentence needs, as the answer.`,
        schema: obj({ items: { type: 'array', items: obj({ collocation: STR, sentence: STR, answer: STR }) } }) });
      const j = IS.parseObj(out.text), items = ((j && j.items) || []).filter(i => i.sentence && i.sentence.includes('___') && i.answer).map(i => ({ c: i.collocation, g: i.sentence, a: i.answer, m: (p.co.items.find(x => x[0] === i.collocation) || [])[3] || i.collocation.replace(i.answer, '…') }));
      if (!items.length) throw new Error('Gemini sent nothing usable. Try again.');
      st.className = 'status'; st.textContent = ''; startQuiz(items);
    } catch (e) { st.className = 'status err'; st.textContent = e.message }
  },
  qCheck() {
    if (!quiz) return; const q = quiz.items[quiz.i], inp = $('qIn'), fb = $('qFb');
    if (quiz.checked) { quiz.i++; quiz.checked = false; return quiz.i < quiz.items.length ? showQ() : endQuiz() }
    const v = normA(inp.value); if (!v) return;
    const ok = v === normA(q.a) || v === normA(q.c) || (normA(q.g.replace('___', q.a)).includes(v) && v.split(' ').includes(normA(q.a)));
    if (ok) quiz.score++; else quiz.missed.push(q.c);
    fb.className = 'pl-fb ' + (ok ? 'good' : 'bad'); fb.textContent = ok ? `Correct: ${q.c}` : `Not quite. The answer is “${q.a}” (${q.c}).`;
    quiz.checked = true; inp.readOnly = true; root.querySelector('[data-act="qCheck"]').textContent = quiz.i + 1 < quiz.items.length ? 'Next' : 'Finish';
  },
  qHint() { if (quiz && !quiz.checked) { $('qIn').value = quiz.items[quiz.i].a[0]; $('qIn').focus() } },
  finish() { const n = view.n, d = rec(n); d.notes = $('plNotes').value.trim(); d.report = buildReport(n); save(); $('plReport').innerHTML = reportHTML(d.report); $('plReport').scrollIntoView({ block: 'nearest' }) },
  async pdf(b) { const n = +b.dataset.n, st = $('plPdfSt' + n); st.className = 'status wait'; st.textContent = 'Making the PDF…'; try { await reportPDF(P.days[n].report); st.className = 'status ok'; st.textContent = 'Saved to your downloads. Keep it with your other daily reports.' } catch (e) { st.className = 'status err'; st.textContent = e.message } },
  bookOpen(b) { openBook(b.dataset.name) },
  async bookDel(b) { await bookDel(b.dataset.name); renderBooks() },
  bookClose() { const v = $('plView'); v.hidden = true; v.innerHTML = ''; if (viewURL) { URL.revokeObjectURL(viewURL); viewURL = null } }
};
root.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) acts[b.dataset.act](b) });
root.addEventListener('input', e => {
  const t = e.target, n = view.n; if (!P || view.name !== 'day') return;
  if (t.dataset.ans) { const r = rec(n)[t.dataset.ans] = rec(n)[t.dataset.ans] || {}; (r.answers = r.answers || [])[+t.dataset.q] = t.value; save() }
  else if (t.dataset.w) { const r = rec(n).W = rec(n).W || {}; r[t.dataset.w] = t.value; save(); const i = t.dataset.w[1], el = t.dataset.w[0] === 't' && $('wc' + i); if (el) { const c = wc(t.value); el.textContent = c + ' words'; el.classList.toggle('ok', c >= +el.dataset.target) } }
  else if (t.dataset.s) { const r = rec(n).S = rec(n).S || {}; r[t.dataset.s] = t.value; save() }
});
root.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.cause) { const r = rec(view.n)[t.dataset.cause]; r.causes = r.causes || {}; r.causes[+t.dataset.q] = t.value; save() }
  else if (t.id === 'plBookIn') { const st = $('plBookSt'); st.className = 'status wait'; st.textContent = 'Saving…'; const { kept, temp } = await bookAdd([...t.files]); t.value = ''; st.className = 'status ' + (temp ? '' : 'ok'); st.textContent = temp ? `${kept} saved. ${temp} too large to keep in this browser: available until you close the page.` : `${kept} file${kept === 1 ? '' : 's'} saved on this device.`; renderBooks() }
  else if (t.id === 'plRestore') { const st = $('plSetupSt'); try { const j = JSON.parse(await t.files[0].text()); if (!j || j.app !== 'ielts-studio-plan' || !j.plan || !j.plan.start) throw 0; P = j.plan; P.days = P.days || {}; save(); render() } catch (err) { st.className = 'status err'; st.textContent = 'That file is not an IELTS Studio plan backup.' } }
  else if (t.id === 'liveModel') store.set('liveModel', t.value.trim());
});
root.addEventListener('toggle', e => { if (e.target.id === 'plBooksD') store.set('plBooksOpen', e.target.open) }, true);

window.Plan = {
  show(parts) {
    const next = parts[1] === 'day' && P ? { name: 'day', n: clampDay(parseInt(parts[2], 10) || 1) } : parts[1] === 'reports' && P ? { name: 'reports', n: 0 } : { name: 'home', n: 0 };
    const same = next.name === view.name && next.n === view.n;
    view = next; render(); if (!same) window.scrollTo(0, 0);
  },
  leave() { stopAllTimers(); liveStop(true); recAbort() },
  stat() { if (!P) return 'Set up your 30 days'; const done = Object.values(P.days).filter(d => d.report).length, t = todayN(); return t < 1 ? `Starts ${nice(dayDate(1))}` : `${t > 30 ? 'Finished' : 'Day ' + t} · ${done} reports` },
  _test: { toMp3, buildReport, reportPDF, dayPlan }
};
IS.route();
})();
