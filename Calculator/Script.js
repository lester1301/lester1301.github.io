const exprEl = document.getElementById("preview");
const resEl = document.getElementById("res");
const keys = document.getElementById("keys");
const hist = document.getElementById("hist");
const hl = document.getElementById("hl");
const toast = document.getElementById("toast");

let expr = "";          // what the user typed
let done = false;       // true right after "="
let history = [];

try { history = JSON.parse(localStorage.getItem("calc-history")) || []; } catch (e) {}

// ---------- expression engine (no eval) ----------
// supports + − × ÷ ^ √ % and brackets, with correct operator precedence
function evaluate(src) {
  const open = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
  src += ")".repeat(Math.max(open, 0));
  const t = src.match(/\d*\.?\d+|[+−×÷^()%√]/g) || [];
  let i = 0;
  const pk = () => t[i], nx = () => t[i++];

  function E() { let v = T(); while (pk() === "+" || pk() === "−") { const o = nx(); const r = T(); v = o === "+" ? v + r : v - r; } return v; }
  function T() { let v = Pw(); while (pk() === "×" || pk() === "÷") { const o = nx(); const r = Pw(); v = o === "×" ? v * r : v / r; } return v; }
  function Pw() { const b = U(); if (pk() === "^") { nx(); return Math.pow(b, Pw()); } return b; }
  function U() {
    if (pk() === "−") { nx(); return -U(); }
    if (pk() === "+") { nx(); return U(); }
    if (pk() === "√") { nx(); return Math.sqrt(U()); }
    let v = Pr();
    while (pk() === "%") { nx(); v /= 100; }
    return v;
  }
  function Pr() {
    const k = nx();
    if (k === "(") { const v = E(); if (pk() === ")") nx(); return v; }
    if (k === undefined || isNaN(+k)) throw new Error("bad");
    return +k;
  }

  const v = E();
  if (i < t.length) throw new Error("bad");
  return v;
}

// 0.1 + 0.2 → 0.3 (not 0.30000000000000004)
const fmt = n => String(parseFloat(n.toPrecision(12)));

function compute(src) {
  try {
    const v = evaluate(src);
    if (v === Infinity || v === -Infinity) return { err: "Can't divide by zero" };
    if (Number.isNaN(v)) return { err: "Invalid input" };
    return { val: fmt(v) };
  } catch (e) { return null; }   // unfinished expression
}

// ---------- display ----------
function render(label) {
  resEl.textContent = expr || "0";
  const n = resEl.textContent.length;
  resEl.style.fontSize = n > 18 ? "1.05rem" : n > 13 ? "1.4rem" : n > 9 ? "1.9rem" : "2.6rem";

  if (label !== undefined) { exprEl.textContent = label; return; }
  const hasOp = /[+−×÷^√%()]/.test(expr.replace(/^−/, ""));
  const r = hasOp ? compute(expr) : null;
  exprEl.textContent = r && r.val ? "= " + r.val : "";
}

function showError(msg) {
  expr = ""; done = false;
  render(msg);
  resEl.textContent = "Error";
  resEl.classList.add("shake");
  setTimeout(() => resEl.classList.remove("shake"), 400);
}

// ---------- input ----------
const isOp = ch => /[+−×÷^]/.test(ch);
const endsValue = () => /[\d.)%]$/.test(expr);

function press(k) {
  if (/^\d$/.test(k)) {
    if (done) { expr = ""; done = false; }
    if (/[)%]$/.test(expr)) expr += "×";
    expr += k;
  }
  else if (k === ".") {
    if (done) { expr = ""; done = false; }
    const cur = expr.match(/[\d.]*$/)[0];
    if (cur.includes(".")) return;
    if (/[)%]$/.test(expr)) expr += "×";
    expr += cur === "" ? "0." : ".";
  }
  else if (isOp(k)) {
    done = false;
    if (expr === "") { if (k === "−") expr = "−"; }
    else if (k === "−" && /[×÷^(]$/.test(expr)) expr += k;
    else if (/[×÷^(]$/.test(expr) && k !== "−") { if (!/\($/.test(expr)) expr = expr.slice(0, -1) + k; }
    else if (isOp(expr.slice(-1))) expr = expr.slice(0, -1) + k;
    else if (expr !== "−" && !/\($/.test(expr)) expr += k;
  }
  else if (k === "(" || k === "√") {
    if (done) { expr = ""; done = false; }
    if (/[\d.)%]$/.test(expr)) expr += "×";
    expr += k === "√" ? "√(" : "(";
  }
  else if (k === ")") {
    const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
    if (open > 0 && endsValue()) expr += ")";
  }
  else if (k === "%" || k === "^2") {
    if (endsValue()) { expr += k; done = false; }
  }
  else if (k === "±") {
    done = false;
    expr = expr.replace(/([+−×÷^(]|^)(−?)([\d.]+)$/, (m, a, s, n) => a + (s ? "" : "−") + n);
  }
  else if (k === "AC") { expr = ""; done = false; }
  else if (k === "⌫") {
    if (done) { expr = ""; done = false; }
    else expr = expr.slice(0, -1);
  }
  else if (k === "=") { return equals(); }
  render();
}

function equals() {
  if (!expr) return;
  const r = compute(expr);
  if (!r) return;                       // unfinished, ignore
  if (r.err) return showError(r.err);
  const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
  const shown = expr + ")".repeat(Math.max(open, 0));
  if (r.val !== expr) {
    history.unshift({ e: shown, r: r.val });
    history = history.slice(0, 20);
    saveHistory();
  }
  expr = r.val;
  done = true;
  render(shown + " =");
}

// ---------- history ----------
function saveHistory() { try { localStorage.setItem("calc-history", JSON.stringify(history)); } catch (e) {} drawHistory(); }
function drawHistory() {
  hl.innerHTML = "";
  if (!history.length) { hl.innerHTML = '<li class="empty">No calculations yet. Press = to save one here.</li>'; return; }
  history.forEach(h => {
    const li = document.createElement("li");
    li.innerHTML = '<small></small><strong></strong>';
    li.firstChild.textContent = h.e;
    li.lastChild.textContent = h.r;
    li.addEventListener("click", () => { expr = h.r; done = true; render(h.e + " ="); hist.classList.remove("open"); });
    hl.appendChild(li);
  });
}
document.getElementById("hbtn").onclick = () => hist.classList.add("open");
document.getElementById("hclose").onclick = () => hist.classList.remove("open");
document.getElementById("hclr").onclick = () => { history = []; saveHistory(); };

// ---------- copy result ----------
function say(msg) { toast.textContent = msg; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 1400); }
resEl.addEventListener("click", () => {
  if (!expr) return;
  (navigator.clipboard ? navigator.clipboard.writeText(expr) : Promise.reject()).then(() => say("Copied " + expr), () => say("Copy not available"));
});

// ---------- buttons ----------
keys.addEventListener("click", e => { const b = e.target.closest("button"); if (b) press(b.dataset.k); });
keys.addEventListener("pointermove", e => {
  const b = e.target.closest("button"); if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty("--x", e.clientX - r.left + "px");
  b.style.setProperty("--y", e.clientY - r.top + "px");
});

// ---------- keyboard ----------
const keyMap = { "-": "−", "*": "×", "/": "÷", Enter: "=", Backspace: "⌫", Escape: "AC", Delete: "AC" };
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = keyMap[e.key] || e.key;
  const btn = [...keys.children].find(b => b.dataset.k === k) || (k === "=" && keys.querySelector(".equals"));
  if (e.key === "^") { press("^"); return; }
  if (!btn) return;
  e.preventDefault();
  btn.classList.add("hit"); setTimeout(() => btn.classList.remove("hit"), 120);
  press(btn.dataset.k);
});

drawHistory();
render();
