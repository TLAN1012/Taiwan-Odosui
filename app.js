"use strict";
// 考試規格（依公路局公開資訊；考前請以監理站公告為準）
const EXAM = { count: 50, perQ: 2, pass: 85, minutes: 30 };
const LS = "odosui.v1", LS_EXAM = "odosui.exam";

const $app = document.getElementById("app");
let LAWS = null, QS = [], TOPICS = [], QMAP = {}, LAWMAP = {}, OFF = null;
let P = load(LS, { stats: {}, marks: [], history: [], theme: "" });
let session = null, timerId = null;

function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

async function boot() {
  applyTheme();
  try {
    const [l, q, o] = await Promise.all(["laws", "questions", "official"].map(n => fetch(`data/${n}.json`).then(r => r.json())));
    LAWS = l; TOPICS = q.topics; OFF = o;
    QS = q.questions.map(x => ({ ...x, src: "self" })).concat(o.questions.map(x => ({ ...x, src: "official", topic: "official" })));
    QS.forEach(x => QMAP[x.id] = x);
    LAWS.laws.forEach(law => { LAWMAP[law.pcode] = law; law.byNo = {}; law.articles.forEach(a => law.byNo[a.no] = a); });
  } catch (e) {
    $app.innerHTML = `<div class="card warn">資料載入失敗：${esc(e.message)}</div>`; return;
  }
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}

function applyTheme() { if (P.theme) document.documentElement.dataset.theme = P.theme; else delete document.documentElement.dataset.theme; }
function stat(id) { return P.stats[id] || (P.stats[id] = { ok: 0, ng: 0, last: null }); }
function record(id, ok) { const s = stat(id); ok ? s.ok++ : s.ng++; s.last = ok; save(LS, P); }
function wrongIds() { return QS.filter(q => P.stats[q.id] && P.stats[q.id].last === false).map(q => q.id); }

function route() {
  clearInterval(timerId);
  const [, r = "", a = "", b = ""] = (location.hash || "#/").split("?")[0].split("/");
  const qs = new URLSearchParams((location.hash.split("?")[1]) || "");
  document.querySelectorAll("#nav a").forEach(x => x.classList.toggle("on", x.dataset.r === r));
  window.scrollTo(0, 0);
  if (r === "practice") return a === "run" ? practiceRun(qs) : practiceMenu();
  if (r === "exam") return a === "run" ? examRun() : a === "result" ? examResult() : examMenu();
  if (r === "laws") return lawsView(a, decodeURIComponent(b), qs);
  if (r === "wrong") return wrongView();
  if (r === "about") return aboutView();
  home();
}

function home() {
  const done = Object.values(P.stats), seen = done.length, ok = done.reduce((n, s) => n + s.ok, 0), all = done.reduce((n, s) => n + s.ok + s.ng, 0);
  const last = P.history[P.history.length - 1];
  $app.innerHTML = `
  <h1>機車考照模擬</h1>
  <div class="grid">
    <div class="card stat"><b>${QS.length}</b><span class="muted small">題庫題數</span></div>
    <div class="card stat"><b>${seen}</b><span class="muted small">已練習題數</span></div>
    <div class="card stat"><b>${pct(ok, all)}%</b><span class="muted small">累計正確率</span></div>
    <div class="card stat"><b>${wrongIds().length}</b><span class="muted small">待複習錯題</span></div>
  </div>
  ${last ? `<div class="card small">上次模擬考：<b class="${last.passed ? "pass" : "fail"}">${last.score} 分（${last.passed ? "及格" : "未及格"}）</b>，${esc(last.date)}</div>` : ""}
  <div class="grid">
    <a class="card btn" href="#/practice"><h3>逐題練習</h3><span class="muted small">官方題庫或自編題，答完立刻對答案</span></a>
    <a class="card btn" href="#/exam"><h3>模擬考</h3><span class="muted small">${EXAM.count} 題、${EXAM.minutes} 分鐘、${EXAM.pass} 分及格</span></a>
    <a class="card btn" href="#/laws"><h3>條文查詢</h3><span class="muted small">處罰條例、安全規則、標誌標線設置規則</span></a>
    <a class="card btn" href="#/wrong"><h3>錯題本</h3><span class="muted small">只練答錯過的題</span></a>
  </div>
  <div class="card small muted">條文資料：${LAWS.laws.map(l => `${esc(l.name)}（${l.amended} 修正）`).join("、")}。</div>`;
}

function practiceMenu() {
  const counts = t => QS.filter(q => q.src === "self" && q.topic === t), off = OFFQ();
  $app.innerHTML = `<h1>逐題練習</h1>
  <div class="card list">
    <a class="item" href="#/practice/run?topic=all&n=20"><b>綜合隨機 20 題</b></a>
    <a class="item" href="#/practice/run?topic=new&n=20"><b>還沒練過的 20 題</b></a>
    <a class="item" href="#/practice/run?topic=marks&n=50"><b>我的收藏</b> <span class="muted small">${P.marks.length} 題</span></a>
  </div>
  <h2>官方題庫（${OFF.version}，${off.length} 題，三選一）</h2>
  <div class="card list">
    <a class="item" href="#/practice/run?topic=off&n=20"><b>官方題庫隨機 20 題</b></a>
    <a class="item" href="#/practice/run?topic=offimg&n=20"><b>圖片題（標誌、標線、號誌、手勢）</b> <span class="muted small">${off.filter(q => q.image).length} 題</span></a>
    ${OFF.cats.map(c => `<a class="item" href="#/practice/run?topic=${encodeURIComponent("cat:" + c)}&n=20"><b>${esc(c)}</b> <span class="muted small">${off.filter(q => q.cat === c).length} 題</span></a>`).join("")}
  </div>
  <h2>自編題依主題（依條文編寫，附詳解）</h2>
  <div class="card list">${TOPICS.map(t => {
    const qs = counts(t.id), s = qs.filter(q => P.stats[q.id]), ok = qs.filter(q => P.stats[q.id] && P.stats[q.id].last).length;
    return `<a class="item" href="#/practice/run?topic=${t.id}&n=${qs.length}"><b>${esc(t.name)}</b> <span class="muted small">${qs.length} 題・已練 ${s.length}・最近答對 ${ok}</span></a>`;
  }).join("")}</div>`;
}

const OFFQ = () => QS.filter(q => q.src === "official");
function pickPool(topic) {
  if (topic === "all") return QS;
  if (topic === "off") return OFFQ();
  if (topic === "offimg") return OFFQ().filter(q => q.image);
  if (topic.startsWith("cat:")) return OFFQ().filter(q => q.cat === topic.slice(4));
  if (topic === "self") return QS.filter(q => q.src === "self");
  if (topic === "new") return QS.filter(q => !P.stats[q.id]);
  if (topic === "marks") return QS.filter(q => P.marks.includes(q.id));
  if (topic === "wrong") return QS.filter(q => wrongIds().includes(q.id));
  return QS.filter(q => q.src === "self" && q.topic === topic);
}

const isAll = t => /^以上/.test(t) && t.length <= 8;
function makeItem(q) {
  const idx = q.options.map((_, i) => i);
  const order = shuffle(idx.filter(i => !isAll(q.options[i]))).concat(idx.filter(i => isAll(q.options[i])));
  return { id: q.id, order, pick: null };
}

function practiceRun(qs) {
  const topic = qs.get("topic") || "all", n = +qs.get("n") || 20;
  const pool = shuffle(pickPool(topic)).slice(0, n);
  if (!pool.length) { $app.innerHTML = `<div class="card">這個範圍目前沒有題目。<a href="#/practice">回主題</a></div>`; return; }
  session = { mode: "practice", topic, items: pool.map(makeItem), i: 0 };
  renderPractice();
}

const qHtml = q => `<div class="qtext">${q.image ? `<img class="qimg" src="${esc(q.image)}" alt="題目圖片">` : ""}${q.q ? esc(q.q) : (q.image ? `<span class="muted">請依圖作答</span>` : "")}</div>`;
const qLabel = q => q.src === "official" ? `官方題庫・${q.cat}` : ((TOPICS.find(t => t.id === q.topic) || {}).name || "");
const explainHtml = q => q.src === "official" ? `<p class="muted small">官方題庫沒有提供詳解與條文出處。</p>` : `<p>${esc(q.explain)}</p>${refsHtml(q, true)}`;

function optionsHtml(q, it, reveal) {
  return it.order.map((oi, k) => {
    let cls = "opt";
    if (reveal) { if (oi === q.answer) cls += " right"; else if (it.pick === oi) cls += " wrong"; }
    else if (it.pick === oi) cls += " picked";
    return `<button class="${cls}" data-pick="${oi}" ${reveal ? "disabled" : ""}>${"ABCD"[k]}．${esc(q.options[oi])}</button>`;
  }).join("");
}

function refsHtml(q, withText) {
  return (q.refs || []).map(r => {
    const law = LAWMAP[r.law], art = law && law.byNo[r.no];
    if (!art) return "";
    const link = `#/laws/${r.law}/${encodeURIComponent(r.no)}?q=${encodeURIComponent(q.quote || "")}`;
    if (!withText) return `<a href="${link}">${esc(law.name)}第 ${esc(r.no)} 條</a>`;
    return `<div class="small"><b>${esc(law.name)}第 ${esc(r.no)} 條</b>（<a href="${link}">全文</a>）</div>${articleHtml(art, q.quote)}`;
  }).join("");
}

function articleHtml(art, quote) {
  let out = art.lines.map(l => {
    let t = esc(l.t);
    if (quote) { const e = esc(quote); if (t.includes(e)) t = t.replace(e, `<mark>${e}</mark>`); }
    return `<div class="law-line lv${l.lv}">${t}</div>`;
  }).join("");
  if (art.pending_lines) out += `<div class="warn small">${esc(art.pending_note)}</div>`;
  if (art.partial) out += `<div class="warn small">本條含圖表，這裡只顯示文字部分，完整內容請至全國法規資料庫查看。</div>`;
  return out;
}

function renderPractice() {
  const s = session, it = s.items[s.i], q = QMAP[it.id], reveal = it.pick !== null;
  const ok = reveal && it.pick === q.answer;
  $app.innerHTML = `
  <div class="row spread small muted"><span>第 ${s.i + 1} / ${s.items.length} 題</span><span>${esc(qLabel(q))}</span></div>
  <div class="bar"><i style="width:${(s.i + (reveal ? 1 : 0)) * 100 / s.items.length}%"></i></div>
  <div class="card">
    ${qHtml(q)}
    <div id="opts">${optionsHtml(q, it, reveal)}</div>
    ${reveal ? `<div class="explain"><div class="verdict ${ok ? "ok" : "bad"}">${ok ? "答對了" : "答錯了，正確答案是 " + "ABCD"[it.order.indexOf(q.answer)]}</div>
      ${explainHtml(q)}</div>` : ""}
  </div>
  <div class="row spread">
    <button id="mark">${P.marks.includes(q.id) ? "★ 已收藏" : "☆ 收藏"}</button>
    <span class="row">
      ${s.i > 0 ? `<button id="prev">上一題</button>` : ""}
      ${reveal ? (s.i < s.items.length - 1 ? `<button class="primary" id="next">下一題</button>` : `<button class="primary" id="fin">完成</button>`) : ""}
    </span>
  </div>`;
  $app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { it.pick = +b.dataset.pick; record(q.id, it.pick === q.answer); renderPractice(); });
  const bind = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  bind("next", () => { s.i++; renderPractice(); });
  bind("prev", () => { s.i--; renderPractice(); });
  bind("mark", () => { const k = P.marks.indexOf(q.id); k < 0 ? P.marks.push(q.id) : P.marks.splice(k, 1); save(LS, P); renderPractice(); });
  bind("fin", () => {
    const right = s.items.filter(x => x.pick === QMAP[x.id].answer).length;
    $app.innerHTML = `<div class="card"><h1>這輪完成</h1><p>答對 <b>${right}</b> / ${s.items.length} 題（${pct(right, s.items.length)}%）</p>
    <div class="row"><a class="btn primary" href="#/practice">再選主題</a><a class="btn" href="#/wrong">看錯題本</a></div></div>`;
  });
}

function examMenu() {
  const saved = load(LS_EXAM, null);
  const hist = P.history.slice(-8).reverse();
  $app.innerHTML = `<h1>模擬考</h1>
  <div class="card"><p>${EXAM.count} 題、每題 ${EXAM.perQ} 分、限時 ${EXAM.minutes} 分鐘，${EXAM.pass} 分以上及格（至少答對 ${Math.ceil(EXAM.pass / EXAM.perQ)} 題）。交卷前不顯示對錯。</p>
  <div class="row"><button class="primary" id="go">官方題庫模擬考（三選一）</button><button id="go-self">自編題模擬考（四選一，交卷後有詳解）</button></div>
  <div class="row" style="margin-top:8px">${saved ? `<button id="resume">繼續上次未交卷（剩 ${mmss(Math.max(0, saved.endAt - Date.now() > 0 ? Math.round((saved.endAt - Date.now()) / 1000) : 0))}）</button>` : ""}</div>
  </div></div>
  ${hist.length ? `<h2>最近成績</h2><div class="card list">${hist.map(h => `<div class="item row spread"><span>${esc(h.date)}</span><b class="${h.passed ? "pass" : "fail"}">${h.score} 分 ${h.passed ? "及格" : "未及格"}</b></div>`).join("")}</div>` : ""}`;
  const start = pool => {
    const qs = shuffle(pickPool(pool)).slice(0, EXAM.count);
    session = { mode: "exam", items: qs.map(makeItem), i: 0, endAt: Date.now() + EXAM.minutes * 60000, startedAt: Date.now() };
    save(LS_EXAM, session); location.hash = "#/exam/run";
  };
  document.getElementById("go").onclick = () => start("off");
  document.getElementById("go-self").onclick = () => start("self");
  const r = document.getElementById("resume");
  if (r) r.onclick = () => { session = saved; location.hash = "#/exam/run"; };
}

function examRun() {
  if (!session || session.mode !== "exam") { session = load(LS_EXAM, null); }
  if (!session) { location.hash = "#/exam"; return; }
  renderExam();
  timerId = setInterval(() => {
    const left = Math.round((session.endAt - Date.now()) / 1000), t = document.getElementById("timer");
    if (left <= 0) { clearInterval(timerId); finishExam(true); return; }
    if (t) { t.textContent = mmss(left); t.classList.toggle("low", left < 300); }
  }, 500);
}

function renderExam() {
  const s = session, it = s.items[s.i], q = QMAP[it.id];
  const left = Math.max(0, Math.round((s.endAt - Date.now()) / 1000));
  const answered = s.items.filter(x => x.pick !== null).length;
  $app.innerHTML = `
  <div class="row spread"><span class="small muted">已答 ${answered} / ${s.items.length}</span><span class="timer ${left < 300 ? "low" : ""}" id="timer">${mmss(left)}</span></div>
  <div class="qnav">${s.items.map((x, k) => `<button data-go="${k}" class="${x.pick !== null ? "done" : ""} ${k === s.i ? "cur" : ""}">${k + 1}</button>`).join("")}</div>
  <div class="card"><div class="small muted">第 ${s.i + 1} 題</div>${qHtml(q)}<div>${optionsHtml(q, it, false)}</div></div>
  <div class="row spread">
    <span class="row">${s.i > 0 ? `<button id="prev">上一題</button>` : ""}${s.i < s.items.length - 1 ? `<button id="next" class="primary">下一題</button>` : ""}</span>
    <button id="submit">交卷</button>
  </div>`;
  $app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { it.pick = +b.dataset.pick; save(LS_EXAM, s); renderExam(); });
  $app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { s.i = +b.dataset.go; renderExam(); });
  const bind = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  bind("next", () => { s.i++; save(LS_EXAM, s); renderExam(); });
  bind("prev", () => { s.i--; save(LS_EXAM, s); renderExam(); });
  bind("submit", () => {
    const blank = s.items.length - s.items.filter(x => x.pick !== null).length;
    if (confirm(blank ? `還有 ${blank} 題沒作答，確定交卷？` : "確定交卷？")) finishExam(false);
  });
}

function finishExam() {
  clearInterval(timerId);
  const s = session; if (!s) return;
  const right = s.items.filter(x => x.pick === QMAP[x.id].answer).length;
  s.items.forEach(x => { if (x.pick !== null) record(x.id, x.pick === QMAP[x.id].answer); else record(x.id, false); });
  const perQ = s.items.length < EXAM.count ? 100 / s.items.length : EXAM.perQ;
  const score = Math.round(right * perQ * 10) / 10;
  const result = { date: new Date().toLocaleString("zh-TW", { hour12: false }), score, right, total: s.items.length, passed: score >= EXAM.pass, secs: Math.round((Date.now() - s.startedAt) / 1000), items: s.items };
  P.history.push({ date: result.date, score, right, total: result.total, passed: result.passed, secs: result.secs });
  P.history = P.history.slice(-50); save(LS, P);
  localStorage.removeItem(LS_EXAM);
  session = { mode: "result", result };
  location.hash = "#/exam/result";
}

function examResult() {
  if (!session || session.mode !== "result") { location.hash = "#/exam"; return; }
  const r = session.result;
  const wrong = r.items.filter(x => x.pick !== QMAP[x.id].answer);
  $app.innerHTML = `<div class="card" style="text-align:center"><div class="score ${r.passed ? "pass" : "fail"}">${r.score}</div>
    <div><b class="${r.passed ? "pass" : "fail"}">${r.passed ? "及格" : "未及格"}</b>（${EXAM.pass} 分及格）</div>
    <p class="muted small">答對 ${r.right} / ${r.total} 題，用時 ${mmss(r.secs)}</p>
    <div class="row" style="justify-content:center"><a class="btn primary" href="#/exam">再考一次</a></div></div>
  <div class="qnav">${r.items.map((x, k) => `<button data-k="${k}" class="${x.pick === QMAP[x.id].answer ? "right" : "wrong"}">${k + 1}</button>`).join("")}</div>
  <h2>答錯 / 未答（${wrong.length}）</h2>${wrong.map(x => reviewCard(x)).join("") || `<div class="card">全部答對。</div>`}`;
}

function reviewCard(it) {
  const q = QMAP[it.id], ok = it.pick === q.answer;
  return `<div class="card">${qHtml(q)}${optionsHtml(q, it, true)}
    <div class="explain"><div class="verdict ${ok ? "ok" : "bad"}">${it.pick === null ? "未作答" : ok ? "答對" : "答錯"}，正確答案 ${"ABCD"[it.order.indexOf(q.answer)]}</div>${explainHtml(q)}</div></div>`;
}

function wrongView() {
  const ids = wrongIds();
  $app.innerHTML = `<h1>錯題本</h1><div class="card"><p>最近一次答錯、還沒答對過的題：<b>${ids.length}</b> 題。答對後會自動移出。</p>
  ${ids.length ? `<a class="btn primary" href="#/practice/run?topic=wrong&n=30">開始複習</a>` : ""}</div>
  ${ids.slice(0, 30).map(id => { const q = QMAP[id]; return `<div class="card small">${q.image ? `<img class="qimg" style="max-height:120px" src="${esc(q.image)}" alt="題目圖片">` : ""}<div>${esc(q.q)}</div><div class="muted">${refsHtml(q, false)}</div></div>`; }).join("")}`;
}

function lawsView(pcode, no, qs) {
  if (!pcode) {
    $app.innerHTML = `<h1>條文查詢</h1>
    <input type="search" id="kw" placeholder="搜尋關鍵字，例如：安全帽、酒精、兩段" autocomplete="off">
    <div id="hits"></div>
    <div class="card list" id="lawlist">${LAWS.laws.map(l => `<a class="item" href="#/laws/${l.pcode}"><b>${esc(l.name)}</b><div class="muted small">${l.articles.length} 條・${l.amended} 修正</div></a>`).join("")}</div>`;
    const kw = document.getElementById("kw");
    kw.oninput = () => {
      const t = kw.value.trim(), h = document.getElementById("hits"), list = document.getElementById("lawlist");
      list.style.display = t ? "none" : "";
      if (!t) { h.innerHTML = ""; return; }
      const found = [];
      for (const l of LAWS.laws) for (const a of l.articles) if (a.lines.some(x => x.t.includes(t))) found.push([l, a]);
      h.innerHTML = `<p class="muted small">找到 ${found.length} 條${found.length > 40 ? "，只顯示前 40 條" : ""}</p><div class="card list">${found.slice(0, 40).map(([l, a]) => {
        const line = a.lines.find(x => x.t.includes(t)).t, i = line.indexOf(t), sn = line.slice(Math.max(0, i - 20), i + 50);
        return `<a class="item" href="#/laws/${l.pcode}/${encodeURIComponent(a.no)}?q=${encodeURIComponent(t)}"><b>${esc(l.name)}第 ${esc(a.no)} 條</b><div class="small muted">…${esc(sn)}…</div></a>`;
      }).join("")}</div>`;
    };
    return;
  }
  const law = LAWMAP[pcode]; if (!law) { $app.innerHTML = `<div class="card">找不到這部法規。</div>`; return; }
  if (!no) {
    let ch = "";
    $app.innerHTML = `<h1>${esc(law.name)}</h1><p class="muted small">${law.amended} 修正・<a href="${law.url}" target="_blank" rel="noopener">全國法規資料庫</a></p>
    ${law.status_note ? `<div class="warn small">此法規有已公布但尚未施行的修正條文；受影響條文會在內文中標示，並以現行有效條文為準。</div>` : ""}
    <div class="card list">${law.articles.map(a => {
      const h = a.chapter !== ch ? `<div class="small muted" style="margin-top:8px"><b>${esc(a.chapter)}</b></div>` : ""; ch = a.chapter;
      return `${h}<a class="item" href="#/laws/${pcode}/${encodeURIComponent(a.no)}"><b>第 ${esc(a.no)} 條</b>${a.pending_lines ? ` <span class="tag">修正未施行</span>` : ""} <span class="muted small">${esc((a.lines[0] || { t: "" }).t.slice(0, 36))}</span></a>`;
    }).join("")}</div>`;
    return;
  }
  const art = law.byNo[no]; if (!art) { $app.innerHTML = `<div class="card">找不到這一條。</div>`; return; }
  const keys = law.articles.map(a => a.no), i = keys.indexOf(no), quote = qs.get("q") || "";
  const rel = QS.filter(q => (q.refs || []).some(r => r.law === pcode && r.no === no));
  $app.innerHTML = `<p class="small"><a href="#/laws/${pcode}">← ${esc(law.name)}</a></p>
  <div class="card"><h3>第 ${esc(no)} 條</h3><div class="small muted">${esc(art.chapter)}</div>${articleHtml(art, quote)}
  ${art.pending_lines ? `<details><summary class="small">看尚未施行的修正條文</summary>${art.pending_lines.map(l => `<div class="law-line lv${l.lv} small">${esc(l.t)}</div>`).join("")}</details>` : ""}</div>
  <div class="row spread">${i > 0 ? `<a class="btn" href="#/laws/${pcode}/${encodeURIComponent(keys[i - 1])}">← 第 ${esc(keys[i - 1])} 條</a>` : "<span></span>"}${i < keys.length - 1 ? `<a class="btn" href="#/laws/${pcode}/${encodeURIComponent(keys[i + 1])}">第 ${esc(keys[i + 1])} 條 →</a>` : ""}</div>
  ${rel.length ? `<h2>相關題目（${rel.length}）</h2><div class="card list">${rel.slice(0, 20).map(q => `<div class="item small">${esc(q.q)}</div>`).join("")}</div>` : ""}`;
}

function aboutView() {
  const self = QS.filter(q => q.src === "self"), byTopic = TOPICS.map(t => `${esc(t.name)} ${self.filter(q => q.topic === t.id).length}`).join("、");
  $app.innerHTML = `<h1>關於</h1><div class="card small">
  <p><b>Taiwan-Odosui</b>：自用機車考照模擬程式（名字取自「歐托拜」（日語オートバイ，機車），大家都說尾字「敗」不好，改成 sui，美的意思）。</p>
  <p><b>官方題庫</b>：${esc(OFF.source)}，共 ${OFF.questions.length} 題（三選一，其中 ${OFF.questions.filter(q => q.image).length} 題為圖片題），依${esc(OFF.license)}使用，資料來源為交通部公路局。官方題庫只有答案，沒有詳解；本站不改動題目文字，僅去除排版造成的多餘空白，並把「以上皆是」這類選項固定放在最後。</p>
  <p><b>自編題</b>：依條文編寫的練習題 ${self.length} 題，每題附出處條文與原文摘錄，<b>不是公路局官方題庫</b>。</p>
  <p>條文來源：全國法規資料庫（政府資料開放授權條款第 1 版）。已公布但尚未施行的修正條文，本程式以現行有效條文為準並另行標示。</p>
  <p>自編題主題分布：${byTopic}。</p>
  <p>考試規格設定：${EXAM.count} 題、每題 ${EXAM.perQ} 分、${EXAM.minutes} 分鐘、${EXAM.pass} 分及格，依公開資訊設定，請以監理站公告為準。</p></div>
  <div class="card row"><span>外觀</span>
  <button data-theme="">跟隨系統</button><button data-theme="light">淺色</button><button data-theme="dark">深色</button></div>
  <div class="card row"><button id="reset">清除我的作答紀錄</button><span class="muted small">只清除這台裝置上的紀錄</span></div>`;
  $app.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => { P.theme = b.dataset.theme; save(LS, P); applyTheme(); });
  document.getElementById("reset").onclick = () => { if (confirm("確定清除所有作答紀錄？")) { P = { stats: {}, marks: [], history: [], theme: P.theme }; save(LS, P); home(); } };
}

boot();
