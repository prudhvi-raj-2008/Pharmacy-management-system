import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore, collection, getDocs, getDoc, setDoc, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA_bYTJ4a1uQCh8rn5tkuy29p3u2SLm8vE",
  authDomain: "medicare-pharmacy-5359e.firebaseapp.com",
  projectId: "medicare-pharmacy-5359e",
  storageBucket: "medicare-pharmacy-5359e.firebasestorage.app",
  messagingSenderId: "1036079623101",
  appId: "1:1036079623101:web:d915de5ce39e17ec1b00d4"
};
const auth = getAuth(initializeApp(firebaseConfig)), db = getFirestore();
const put = (c, o) => setDoc(doc(db, c, String(o.id)), o);   // create or update one record
const rm = (c, id) => deleteDoc(doc(db, c, String(id)));      // delete one record
window.addEventListener('unhandledrejection', e => alert('Something went wrong: ' + (e.reason && e.reason.message)));
const $ = s => document.querySelector(s);
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const inr = n => '₹' + Number(n).toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Data (with sample records on first run) ---------- */
const SEED_SUP = [
  { id: 1, name: 'Sun Pharma Distributors', phone: '9876543210', email: 'orders@sunpharma.example' },
  { id: 2, name: 'HealthPlus Wholesale', phone: '9123456780', email: 'sales@healthplus.example' }];
const SEED_MEDS = [
  { id: 1, name: 'Paracetamol 500mg', cat: 'Painkiller', batch: 'PC101', qty: 120, price: 2.5, expiry: day(400), sup: 1 },
  { id: 2, name: 'Amoxicillin 250mg', cat: 'Antibiotic', batch: 'AM220', qty: 8, price: 9, expiry: day(200), sup: 2 },
  { id: 3, name: 'Cetirizine 10mg', cat: 'Antiallergic', batch: 'CT330', qty: 60, price: 3, expiry: day(20), sup: 1 },
  { id: 4, name: 'Ibuprofen 400mg', cat: 'Painkiller', batch: 'IB440', qty: 45, price: 4.5, expiry: day(-10), sup: 2 },
  { id: 5, name: 'Metformin 500mg', cat: 'Diabetes', batch: 'MF550', qty: 90, price: 3.2, expiry: day(300), sup: 1 },
  { id: 6, name: 'Omeprazole 20mg', cat: 'Antacid', batch: 'OM660', qty: 5, price: 6, expiry: day(500), sup: 2 }];
let sup = [], meds = [], sales = [], rx = [];
let cart = [], cur = 'dash';
async function loadData() {
  const init = doc(db, 'meta', 'init');
  if (!(await getDoc(init)).exists()) {   // first ever login: add sample data once
    await Promise.all([...SEED_SUP.map(o => put('suppliers', o)), ...SEED_MEDS.map(o => put('medicines', o)), setDoc(init, { done: true })]);
  }
  const get = async c => (await getDocs(collection(db, c))).docs.map(d => d.data());
  [sup, meds, sales, rx] = await Promise.all(['suppliers', 'medicines', 'sales', 'prescriptions'].map(get));
}
const supName = id => (sup.find(s => s.id == id) || {}).name || '—';

/* ---------- Stock rules ---------- */
const LOW = 10, SOON = 30;
const daysLeft = m => Math.round((new Date(m.expiry) - new Date(day(0))) / 864e5);
const status = m => { const d = daysLeft(m); return d < 0 ? ['Expired', 'r'] : d <= SOON ? ['Expiring soon', 'o'] : m.qty <= LOW ? ['Low stock', 'y'] : ['In stock', 'g'] };
function alerts() {
  const a = [];
  meds.forEach(m => {
    const d = daysLeft(m);
    if (d < 0) a.push({ t: `${m.name} (batch ${m.batch}) expired ${-d} day(s) ago`, r: 1 });
    else if (d <= SOON) a.push({ t: `${m.name} expires in ${d} day(s)` });
    if (m.qty <= LOW) a.push({ t: `${m.name} is low on stock – only ${m.qty} left`, r: m.qty == 0 });
  });
  return a;
}

/* ---------- Dashboard advice ---------- */
const ADVICE = [
  ['Valid licence and registered pharmacist', 'Show the drug licence number on the site. A registered pharmacist must check and approve every dispensing of medicines.'],
  ['Prescription check for restricted drugs', 'Sell Schedule H, H1 and X medicines only against a valid prescription. Record patient, doctor and date in the Prescriptions page.'],
  ['Never sell expired or damaged stock', 'Check batch number and expiry on every pack. Remove expired medicines from sale, as this system does automatically.'],
  ['Store medicines correctly', 'Keep stock away from heat, light and moisture. Use cold storage for insulin, vaccines and other temperature-sensitive items.'],
  ['Issue a proper bill for every sale', 'Each invoice should list medicine, batch, expiry, price and date. Keep these records for audits and drug recalls.'],
  ['Protect patient data', 'Use role-based logins, hash passwords, and never share prescriptions or health details. Follow data protection law such as India\'s DPDP Act 2023.'],
  ['Use secure payments only', 'Accept payments through a trusted gateway with HTTPS. Never store card numbers, CVV or UPI PINs yourself.'],
  ['Add a medical disclaimer', 'State that the platform does not replace a doctor. Show dosage and side-effect information, and an emergency contact number.'],
  ['Use first-expiry-first-out and audit stock', 'Sell the batch that expires soonest first, and count physical stock regularly to match the system.'],
  ['Have a recall and return policy', 'Track sales by batch so recalled medicines can be traced to customers quickly. Never resell returned medicines.']
];

/* ---------- Login ---------- */
const errMsg = x => ({ 'auth/invalid-credential': 'Wrong email or password.', 'auth/email-already-in-use': 'This email is already registered. Log in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.' }[x.code] || x.message);
$('#lf').onsubmit = async e => {
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $('#u').value.trim(), $('#p').value) } catch (x) { alert(errMsg(x)) }
};
$('#reg').onclick = async e => {
  e.preventDefault();
  try { await createUserWithEmailAndPassword(auth, $('#u').value.trim(), $('#p').value) } catch (x) { alert(errMsg(x)) }
};
$('#out').onclick = () => signOut(auth);
function start() {
  $('#login').classList.add('hide'); $('#app').classList.remove('hide');
  $('#who').textContent = auth.currentUser.email; go('dash');
}

/* ---------- Navigation ---------- */
const titles = { dash: 'Dashboard', meds: 'Medicine inventory', bill: 'Billing', sales: 'Sales history', sup: 'Suppliers', rx: 'Prescriptions', rep: 'Reports' };
document.querySelectorAll('#nav [data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
$('#burger').onclick = () => $('#nav').classList.toggle('open');
$('#bell').onclick = showAlerts;
function go(v) {
  cur = v; $('#title').textContent = titles[v];
  document.querySelectorAll('#nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v == v));
  $('#view').innerHTML = views[v](); $('#nav').classList.remove('open');
  $('#cnt').textContent = alerts().length;
  if (v == 'meds') fillMeds(); if (v == 'bill') drawCart();
}

/* ---------- Modal helpers ---------- */
function modal(h) { const m = $('#modal'); m.innerHTML = `<div class="box">${h}<button class="x" onclick="closeM()" aria-label="Close">✕</button></div>`; m.classList.remove('hide') }
const closeM = () => $('#modal').classList.add('hide');
function formM(title, fields, vals, cb) {
  modal(`<h3>${title}</h3><form id="mf">${fields.map(([k, l, t, o]) => `<label>${l}${t == 'select'
    ? `<select name="${k}">${o.map(([v, n]) => `<option value="${v}" ${vals[k] == v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`
    : t == 'textarea' ? `<textarea name="${k}" rows="3" required>${esc(vals[k] || '')}</textarea>`
      : `<input name="${k}" type="${t}" value="${esc(vals[k] ?? '')}" ${t == 'number' ? 'min="0" step="any"' : ''} required>`}</label>`).join('')}<button class="btn">Save</button></form>`);
  $('#mf').onsubmit = e => { e.preventDefault(); cb(Object.fromEntries(new FormData(e.target))); closeM() };
}
function showAlerts() {
  const a = alerts();
  modal(`<h3>Notifications</h3>${a.length ? a.map(x => `<div class="alert ${x.r ? 'r' : ''}">${esc(x.t)}</div>`).join('') : '<p class="empty">No alerts. Stock and expiry dates look fine.</p>'}`);
}

/* ---------- Views ---------- */
const views = {
  dash() {
    const t = new Date().toLocaleDateString(), td = sales.filter(s => s.date.startsWith(t));
    const a = alerts();
    return `<div class="stats">
      <div class="stat"><b>${meds.length}</b><span>Medicines listed</span></div>
      <div class="stat o"><b>${meds.filter(m => m.qty <= LOW).length}</b><span>Low-stock items</span></div>
      <div class="stat r"><b>${meds.filter(m => daysLeft(m) <= SOON).length}</b><span>Expired or expiring</span></div>
      <div class="stat"><b>${td.length}</b><span>Sales today</span></div>
      <div class="stat"><b>${inr(td.reduce((s, x) => s + x.total, 0))}</b><span>Revenue today</span></div></div>
      <div class="card"><h3>Alerts</h3>${a.length ? a.map(x => `<div class="alert ${x.r ? 'r' : ''}">${esc(x.t)}</div>`).join('') : '<p class="empty">All clear.</p>'}</div>
      <div class="card"><h3>Mandatory safety and compliance advice</h3><div class="tips">${ADVICE.map(([t, d]) => `<div class="tip"><b>${t}</b><p>${d}</p></div>`).join('')}</div>
      <p class="note">General guidance for this academic project. Check current local drug laws before running a real pharmacy.</p></div>`;
  },
  meds() {
    return `<div class="bar"><input id="q" placeholder="Search by name, category or batch" oninput="fillMeds()">
      <select id="fs" style="width:auto;margin:0" onchange="fillMeds()"><option value="">All status</option><option>In stock</option><option>Low stock</option><option>Expiring soon</option><option>Expired</option></select>
      <button class="btn" onclick="openMed()">+ Add medicine</button></div>
      <div class="card wrap"><table><thead><tr><th>Name</th><th>Category</th><th>Batch</th><th>Qty</th><th>Price</th><th>Expiry</th><th>Supplier</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  },
  bill() {
    const ok = meds.filter(m => m.qty > 0 && daysLeft(m) >= 0);
    return `<div class="two"><div class="card"><h3>New sale</h3>
      <input id="cn" placeholder="Customer name" value="Walk-in customer">
      <select id="bm">${ok.map(m => `<option value="${m.id}">${esc(m.name)} – ${inr(m.price)} (stock ${m.qty})</option>`).join('')}</select>
      <input id="bq" type="number" min="1" value="1"><button class="btn grn" onclick="addCart()">Add to cart</button>
      <p class="empty">Expired and out-of-stock medicines are hidden.</p></div>
      <div class="card"><h3>Cart</h3><div id="cart"></div></div></div>`;
  },
  sales() {
    return `<div class="card wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th></th></tr></thead><tbody>${
      sales.length ? [...sales].reverse().map(s => `<tr><td>${s.id}</td><td>${esc(s.date)}</td><td>${esc(s.customer)}</td><td>${s.items.length}</td><td>${inr(s.total)}</td><td><button class="btn sm sec" onclick="invoice('${s.id}')">View invoice</button></td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">No sales yet. Make one from Billing.</td></tr>'}</tbody></table></div>`;
  },
  sup() {
    return `<div class="bar"><button class="btn" onclick="openSup()">+ Add supplier</button></div><div class="card wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Medicines supplied</th><th></th></tr></thead><tbody>${
      sup.length ? sup.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.phone)}</td><td>${esc(s.email)}</td><td>${meds.filter(m => m.sup == s.id).length}</td>
      <td><button class="btn sm sec" onclick="openSup(${s.id})">Edit</button><button class="btn sm dng" onclick="del('sup',${s.id})">Delete</button></td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">No suppliers yet.</td></tr>'}</tbody></table></div>`;
  },
  rx() {
    return `<div class="bar"><button class="btn" onclick="openRx()">+ Add prescription</button></div><div class="card wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Doctor</th><th>Medicines prescribed</th><th></th></tr></thead><tbody>${
      rx.length ? rx.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.patient)}</td><td>${esc(r.doctor)}</td><td style="white-space:normal">${esc(r.notes)}</td><td><button class="btn sm dng" onclick="del('rx',${r.id})">Delete</button></td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">No prescriptions recorded.</td></tr>'}</tbody></table></div>`;
  },
  rep() {
    const sold = {}; sales.forEach(s => s.items.forEach(i => sold[i.name] = (sold[i.name] || 0) + i.qty));
    const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top.length ? top[0][1] : 1;
    return `<div class="stats"><div class="stat"><b>${inr(sales.reduce((s, x) => s + x.total, 0))}</b><span>Total revenue</span></div>
      <div class="stat"><b>${sales.length}</b><span>Invoices generated</span></div>
      <div class="stat"><b>${inr(meds.reduce((s, m) => s + m.qty * m.price, 0))}</b><span>Current stock value</span></div></div>
      <div class="card"><h3>Top-selling medicines (units)</h3>${top.length ? top.map(([n, q]) => `<div class="rb"><span>${esc(n)}</span><i style="width:${q / mx * 55}%"></i><b>${q}</b></div>`).join('') : '<p class="empty">Sales data will appear here after your first sale.</p>'}</div>
      <div class="card"><h3>Stock level by medicine</h3>${meds.map(m => `<div class="rb"><span>${esc(m.name)}</span><i style="width:${Math.min(m.qty, 150) / 150 * 55}%;background:${m.qty <= LOW ? 'var(--red)' : 'var(--acc)'}"></i><b>${m.qty}</b></div>`).join('')}</div>`;
  }
};

/* ---------- Medicines (add / edit / delete / search) ---------- */
function fillMeds() {
  const q = ($('#q').value || '').toLowerCase(), f = $('#fs').value;
  const r = meds.filter(m => (m.name + m.cat + m.batch).toLowerCase().includes(q) && (!f || status(m)[0] == f));
  $('#tb').innerHTML = r.length ? r.map(m => { const s = status(m); return `<tr><td>${esc(m.name)}</td><td>${esc(m.cat)}</td><td>${esc(m.batch)}</td><td>${m.qty}</td><td>${inr(m.price)}</td><td>${m.expiry}</td><td>${esc(supName(m.sup))}</td>
    <td><span class="tag ${s[1]}">${s[0]}</span></td><td><button class="btn sm sec" onclick="openMed(${m.id})">Edit</button><button class="btn sm dng" onclick="del('meds',${m.id})">Delete</button></td></tr>` }).join('')
    : '<tr><td colspan="9" class="empty">No medicines match. Change the search or add a new medicine.</td></tr>';
}
function openMed(id) {
  const m = meds.find(x => x.id == id) || {};
  formM(id ? 'Edit medicine' : 'Add medicine', [['name', 'Medicine name', 'text'], ['cat', 'Category', 'text'], ['batch', 'Batch number', 'text'], ['qty', 'Quantity', 'number'], ['price', 'Price per unit (₹)', 'number'], ['expiry', 'Expiry date', 'date'], ['sup', 'Supplier', 'select', sup.map(s => [s.id, s.name])]], m, async d => {
    d.qty = +d.qty; d.price = +d.price; d.sup = +d.sup;
    let o = m; if (id) Object.assign(m, d); else { o = { id: Date.now(), ...d }; meds.push(o); } await put('medicines', o); go('meds');
  });
}
function openSup(id) {
  const s = sup.find(x => x.id == id) || {};
  formM(id ? 'Edit supplier' : 'Add supplier', [['name', 'Supplier name', 'text'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email']], s, async d => {
    let o = s; if (id) Object.assign(s, d); else { o = { id: Date.now(), ...d }; sup.push(o); } await put('suppliers', o); go('sup');
  });
}
function openRx() {
  formM('Add prescription', [['patient', 'Patient name', 'text'], ['doctor', 'Doctor name', 'text'], ['date', 'Date', 'date'], ['notes', 'Medicines and dosage', 'textarea']], { date: day(0) }, async d => { const o = { id: Date.now(), ...d }; rx.push(o); await put('prescriptions', o); go('rx'); });
}
async function del(k, id) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  if (k == 'meds') meds = meds.filter(x => x.id != id); if (k == 'sup') sup = sup.filter(x => x.id != id); if (k == 'rx') rx = rx.filter(x => x.id != id);
  await rm({ meds: 'medicines', sup: 'suppliers', rx: 'prescriptions' }[k], id); go(k);
}

/* ---------- Billing ---------- */
function addCart() {
  const m = meds.find(x => x.id == $('#bm').value), q = +$('#bq').value;
  if (!m) return alert('No medicine available to sell.');
  if (!(q > 0)) return alert('Enter a quantity of 1 or more.');
  const c = cart.find(x => x.id == m.id), have = c ? c.qty : 0;
  if (have + q > m.qty) return alert(`Only ${m.qty} unit(s) of ${m.name} in stock.`);
  c ? c.qty += q : cart.push({ id: m.id, name: m.name, qty: q, price: m.price }); drawCart();
}
function drawCart() {
  const t = cart.reduce((s, i) => s + i.qty * i.price, 0);
  $('#cart').innerHTML = cart.length ? `<div class="wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th><th></th></tr></thead><tbody>${cart.map((i, n) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${inr(i.price)}</td><td>${inr(i.qty * i.price)}</td><td><button class="btn sm dng" onclick="removeCart(${n})">Remove</button></td></tr>`).join('')}</tbody></table></div>
    <div class="tot">Total: ${inr(t)}</div><button class="btn grn" onclick="checkout()">Generate invoice</button>` : '<p class="empty">Cart is empty. Add a medicine to start a sale.</p>';
}
async function checkout() {
  if (!cart.length) return;
  const s = { id: 'INV' + (1001 + sales.length), date: new Date().toLocaleString(), customer: $('#cn').value.trim() || 'Walk-in customer', items: cart, total: cart.reduce((a, i) => a + i.qty * i.price, 0) };
  cart.forEach(i => meds.find(m => m.id == i.id).qty -= i.qty);
  sales.push(s); cart = [];
  await put('sales', s); await Promise.all(s.items.map(i => put('medicines', meds.find(m => m.id == i.id))));
  go('bill'); invoice(s.id);
}
function invoice(id) {
  const s = sales.find(x => x.id == id);
  modal(`<h3>MediCare Pharmacy – Invoice ${s.id}</h3><p>Date: ${esc(s.date)}<br>Customer: ${esc(s.customer)}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${s.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${inr(i.price)}</td><td>${inr(i.qty * i.price)}</td></tr>`).join('')}</tbody></table>
    <div class="tot">Total: ${inr(s.total)}</div><button class="btn noprint" onclick="window.print()">Print invoice</button>`);
}

/* ---------- Init ---------- */
const removeCart = n => { cart.splice(n, 1); drawCart() };
Object.assign(window, { closeM, fillMeds, openMed, openSup, openRx, del, addCart, checkout, invoice, removeCart });

onAuthStateChanged(auth, async u => {
  if (u) {
    try { await loadData() } catch (x) { alert('Could not load data. Check your Firestore rules and internet connection.\n' + x.message) }
    start();
  } else {
    sup = []; meds = []; sales = []; rx = []; cart = [];
    $('#app').classList.add('hide'); $('#login').classList.remove('hide'); $('#p').value = '';
  }
});