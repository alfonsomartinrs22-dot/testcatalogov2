// Autopiezas Salamanca - App v3 (Neon Postgres auth)
const PRODUCTS_KEY = 'as_products_v1';
const CART_KEY_PREFIX = 'as_cart_';
const EXCEL_URL = 'productos.xlsx';
const PRODUCTS_META_KEY = PRODUCTS_KEY + '_meta';
const THEME_KEY = 'as_theme';
const TOKEN_KEY = 'as_token';
const USER_KEY = 'as_user';

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ===== THEME SYSTEM =====
function getTheme() { return localStorage.getItem(THEME_KEY) || 'dark'; }
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
setTheme(getTheme());

// ===== AUTH TABS =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = document.querySelector(`.tab-content[data-tab="${target}"]`);
      if (content) content.classList.add('active');
    });
  });
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
});

// ================================================================
// ===== SESSION — now backed by API token =====
// ================================================================
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function getSession() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
function setSession(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(USER_KEY);
  clearToken();
}
function logout() {
  clearSession();
  location.reload();
}

// API call helper
async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ===== LOGIN via API =====
async function handleLogin(email, password) {
  const data = await apiCall('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  setToken(data.token);
  setSession({
    username: data.user.email,
    email: data.user.email,
    role: data.user.role,
    businessName: data.user.businessName,
    id: data.user.id
  });
  return data.user;
}

// ===== REGISTER via API =====
async function handleRegister(email, password, businessName) {
  const data = await apiCall('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      businessName: businessName.trim()
    })
  });
  // Auto-login after register
  setToken(data.token);
  setSession({
    username: data.user.email,
    email: data.user.email,
    role: data.user.role,
    businessName: data.user.businessName,
    id: data.user.id
  });
  return data.user;
}

// ===== VERIFY SESSION on load =====
async function verifySession() {
  const token = getToken();
  const cached = getSession();
  if (!token || !cached) { clearSession(); return null; }
  try {
    const data = await apiCall('/api/me');
    const user = {
      username: data.user.email,
      email: data.user.email,
      role: data.user.role,
      businessName: data.user.businessName,
      id: data.user.id
    };
    setSession(user);
    return user;
  } catch {
    clearSession();
    return null;
  }
}

// === Overrides de porcentajes ===
const PCT_OVR_KEY = 'as_pct_overrides_v1';
function getPctOverrides(){ try { return JSON.parse(localStorage.getItem(PCT_OVR_KEY)) || {}; } catch { return {}; } }
function setPctOverrides(map){ localStorage.setItem(PCT_OVR_KEY, JSON.stringify(map)); }
function upsertPctOverride(codigo, costo, gan){
  const map = getPctOverrides();
  map[codigo] = { costo: toNumber(costo), gan: toNumber(gan) };
  setPctOverrides(map);
}
function applyPctOverrides(list, map){
  return list.map(p => {
    const o = map[p.codigo];
    if (o){ p.porcentaje_costo = toNumber(o.costo); p.porcentaje_ganancia = toNumber(o.gan); }
    return p;
  });
}

// === Mis pedidos (historial — sigue en localStorage por usuario) ===
const ORDERS_KEY_PREFIX = 'as_orders_';
function getOrders(username){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY_PREFIX+username))||[]; }catch{ return []; } }
function setOrders(username, orders){ localStorage.setItem(ORDERS_KEY_PREFIX+username, JSON.stringify(orders)); }

// === Listas favoritas ===
const FAV_KEY_PREFIX = 'as_favlists_';
function getFavLists(username){ try { return JSON.parse(localStorage.getItem(FAV_KEY_PREFIX + username)) || []; } catch { return []; } }
function setFavLists(username, lists){ localStorage.setItem(FAV_KEY_PREFIX + username, JSON.stringify(lists)); }

function buildOrderSnapshot(username, channel){
  const cart = getCart(username);
  const { filename, html, total } = buildCartExcelHtml(username);
  const itemCount = (cart.items||[]).reduce((a,it)=> a + Math.max(1, toNumber(it.cantidad)), 0);
  return {
    id: 'P' + Date.now(),
    date: new Date().toISOString(),
    user: username,
    channel: channel || 'Manual',
    total: Number(total.toFixed(2)),
    itemCount,
    excelFilename: filename,
    excelHtml: html,
    items: (cart.items||[]).map(it=>({
      producto: it.producto, codigo: it.codigo,
      precio_lista: toNumber(it.precio_lista),
      porcentaje_costo: toNumber(it.porcentaje_costo),
      porcentaje_ganancia: toNumber(it.porcentaje_ganancia),
      cantidad: Math.max(1, toNumber(it.cantidad))
    }))
  };
}
function saveOrder(username, order){ const list = getOrders(username); list.unshift(order); setOrders(username, list); }

function exportOrderExcel(username, orderId){
  const ord = getOrders(username).find(o => o.id === orderId);
  if (!ord) return showToast('Pedido no encontrado.', 'error');
  const blob = new Blob([ord.excelHtml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = ord.excelFilename || `pedido_${orderId}.xls`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function ensureOrdersUI(){
  const actions = document.querySelector('.actions');
  if (actions && !document.getElementById('btnOrders')){
    const b = document.createElement('button');
    b.id = 'btnOrders'; b.className = 'warning'; b.textContent = '📋 Pedidos';
    actions.insertBefore(b, actions.firstChild);
  }
  if (!document.getElementById('ordersModal')){
    const modal = document.createElement('div');
    modal.id = 'ordersModal'; modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header"><h3>📋 Mis pedidos</h3><button id="closeOrders" class="icon-btn">✕</button></div>
        <div class="orders-body">
          <div id="ordersEmpty" class="empty hidden">No tenés pedidos enviados todavía.</div>
          <div class="table-wrap"><table class="catalog"><thead><tr>
            <th>Fecha</th><th>ID</th><th>Cant.</th><th>Total</th><th>Canal</th><th>Acciones</th>
          </tr></thead><tbody id="ordersBody"></tbody></table></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  if (!document.getElementById('orderDetailModal')){
    const modal = document.createElement('div');
    modal.id = 'orderDetailModal'; modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h3>Detalle del pedido</h3><button id="closeOrderDetail" class="icon-btn">✕</button></div>
        <div class="orders-body"><div id="orderDetailContent" class="cart-items"></div></div>
      </div>`;
    document.body.appendChild(modal);
  }
  const btnOrders = document.getElementById('btnOrders');
  if (btnOrders) btnOrders.addEventListener('click', openOrders);
  const closeOrdersBtn = document.getElementById('closeOrders');
  if (closeOrdersBtn) closeOrdersBtn.addEventListener('click', closeOrders);
  const closeDetailBtn = document.getElementById('closeOrderDetail');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => { document.getElementById('orderDetailModal').classList.add('hidden'); document.body.style.overflow = ''; });
  ensureFavListsUI();
}

function openOrders(){
  const session = getSession();
  if (!session) return showToast('Debés iniciar sesión.', 'error');
  const orders = getOrders(session.username);
  const tbody = document.getElementById('ordersBody');
  const empty = document.getElementById('ordersEmpty');
  tbody.innerHTML = '';
  if (!orders.length){ empty.classList.remove('hidden'); }
  else {
    empty.classList.add('hidden');
    orders.forEach(ord => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(ord.date).toLocaleString()}</td>
        <td><span class="badge">${ord.id}</span></td>
        <td class="num">${ord.itemCount}</td>
        <td class="num">${fmt.format(ord.total)}</td>
        <td>${ord.channel || '-'}</td>
        <td class="row-actions">
          <button class="secondary btn-download" data-id="${ord.id}">📥 Excel</button>
          <button class="icon-btn btn-detail" data-id="${ord.id}">👁</button>
        </td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.btn-download').forEach(btn => btn.addEventListener('click', e => exportOrderExcel(session.username, e.currentTarget.dataset.id)));
    tbody.querySelectorAll('.btn-detail').forEach(btn => btn.addEventListener('click', e => openOrderDetail(session.username, e.currentTarget.dataset.id)));
  }
  document.getElementById('ordersModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeOrders(){ document.getElementById('ordersModal').classList.add('hidden'); document.body.style.overflow = ''; }

function openOrderDetail(username, id){
  const ord = getOrders(username).find(o => o.id === id);
  if (!ord) return;
  const cont = document.getElementById('orderDetailContent');
  cont.innerHTML = '';
  ord.items.forEach(it => {
    const precioCosto = calcCosto(it.precio_lista, it.porcentaje_costo);
    const precioMostrador = calcMostrador(precioCosto, it.porcentaje_ganancia);
    const sub = Number((precioCosto * it.cantidad).toFixed(2));
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <h4>${it.producto} <span class="badge">${it.codigo}</span></h4>
      <div class="num">${fmt.format(precioMostrador)}</div>
      <div class="num">${toNumber(it.porcentaje_costo)}% / ${toNumber(it.porcentaje_ganancia)}%</div>
      <div class="num">${fmt.format(precioCosto)}</div>
      <div class="num">x${it.cantidad}</div>
      <div class="num">${fmt.format(sub)}</div>`;
    cont.appendChild(row);
  });
  document.getElementById('orderDetailModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  return Number(String(v).replace(',','.').replace(/[^0-9.\-]/g,'')) || 0;
}
const normalize = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function calcCosto(precioLista, pctCosto) {
  return Math.max(0, Number((toNumber(precioLista) * (1 - toNumber(pctCosto)/100)).toFixed(2)));
}
function calcMostrador(precioCosto, pctGan) {
  return Math.max(0, Number((toNumber(precioCosto) * (1 + toNumber(pctGan)/100)).toFixed(2)));
}

/* === SYNC CART ⇄ CATALOG === */
function getLatestProductByCode(code){
  return _cachedProducts.find(p => p.codigo === code) || (getProducts() || []).find(p => p.codigo === code) || null;
}
function hydrateCartItem(it){
  const latest = getLatestProductByCode(it.codigo);
  if (!latest) return it;
  return { ...it, producto: latest.producto, precio_lista: toNumber(latest.precio_lista), porcentaje_costo: toNumber(latest.porcentaje_costo), porcentaje_ganancia: toNumber(latest.porcentaje_ganancia) };
}
function syncCartPrices(username){
  if (!username) return getCart(username);
  const cart = getCart(username);
  if (!cart?.items?.length) return cart;
  let changed = false;
  const newItems = cart.items.map(it => {
    const h = hydrateCartItem(it);
    if (h !== it && (h.precio_lista !== it.precio_lista || h.porcentaje_costo !== it.porcentaje_costo || h.porcentaje_ganancia !== it.porcentaje_ganancia || h.producto !== it.producto)) changed = true;
    return h;
  });
  if (changed) setCart(username, { items: newItems });
  return { items: newItems };
}

// ====== SEARCH ======
let _cachedProducts = [];
function buildIndex(list) {
  list.forEach(p => { p._producto_lc = normalize(p.producto); p._codigo_lc = normalize(p.codigo); p._search = (p._producto_lc + ' ' + p._codigo_lc).trim(); });
  return list;
}
function tokenize(q) { return normalize(q).split(/\s+/).filter(Boolean); }
function computeFiltered(products, q) {
  if (!q) return products;
  const terms = tokenize(q);
  if (!terms.length) return products;
  const matches = [];
  for (const p of products) {
    let ok = true;
    for (const t of terms) { if (!p._search.includes(t)) { ok = false; break; } }
    if (!ok) continue;
    let score = 0;
    for (const t of terms) { if (p._codigo_lc.startsWith(t)) score += 2; if (p._producto_lc.startsWith(t)) score += 1; }
    matches.push([score, p]);
  }
  matches.sort((a,b) => b[0]-a[0]);
  return matches.map(x => x[1]);
}

// ====== UI refs ======
const authView = $('#authView');
const appView = $('#appView');
const adminPanel = $('#globalControls');
const userInfo = $('#userInfo');
const catalogBody = $('#catalogBody');
const loginForm = $('#loginForm');
const loginUser = $('#loginUser');
const loginPass = $('#loginPass');
const registerForm = $('#registerForm');
const regUser = $('#regUser');
const regPass = $('#regPass');
const regBiz = $('#regBiz');
const searchInput = $('#searchInput');
const searchStatus = $('#searchStatus');
const loadingIndicator = $('#loadingIndicator');
const btnCart = $('#btnCart');
const cartModal = $('#cartModal');
const closeCart = $('#closeCart');
const cartItems = $('#cartItems');
const cartCount = $('#cartCount');
const subtotalView = $('#subtotalView');
const totalView = $('#totalView');
const btnExportExcel = $('#btnExportExcel');
const btnLogout = $('#btnLogout');
const btnClearCart = $('#btnClearCart');
const btnFavLists = $('#btnFavLists');
const globalControls = $('#globalControls');
const globalPctCosto = $('#globalPctCosto');
const globalPctGan = $('#globalPctGan');
const applyGlobalAll = $('#applyGlobalAll');
const applyGlobalFiltered = $('#applyGlobalFiltered');
const confirmModal = $('#confirmModal');
const confirmText = $('#confirmText');
const confirmAddBtn = $('#confirmAdd');
const confirmCancelBtn = $('#confirmCancel');
const confirmViewCartBtn = $('#confirmViewCart');
const confirmCloseBtn = $('#confirmClose');

function setSearching(flag){ try{ if(searchStatus) searchStatus.classList.toggle('hidden', !flag); }catch(e){} }
function setLoading(flag){ try{ if(loadingIndicator) loadingIndicator.classList.toggle('hidden', !flag); }catch(e){} }

function showAuth() {
  authView.classList.remove('hidden');
  appView.classList.add('hidden');
  userInfo.classList.add('hidden');
}
function showApp(session) {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  userInfo.classList.remove('hidden');
  const bizLabel = session.businessName ? ` — ${session.businessName}` : '';
  userInfo.innerHTML = `<span class="badge">${session.role.toUpperCase()}</span> ${session.email || session.username}${bizLabel}`;
  // Solo admin ve el panel
  if (session.role === 'admin') {
    adminPanel.classList.remove('hidden');
    initAdminPanel();
  } else {
    adminPanel.classList.add('hidden');
  }
  loadProductsAndRender(session);
  renderCartBadge(session.username);
  ensureOrdersUI();
  setupSortListeners();
  setupScrollToTop();
}

// ===== SCROLL TO TOP =====
function setupScrollToTop() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;
  window.addEventListener('scroll', () => { btn.classList.toggle('hidden', window.scrollY < 300); });
  btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

// ===== ADMIN PANEL TOGGLE =====
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleAdmin');
  const adminBody = document.getElementById('adminBody');
  const adminHeader = document.getElementById('adminHeaderToggle');
  if (toggleBtn && adminBody && adminHeader) {
    adminHeader.addEventListener('click', () => {
      adminBody.classList.toggle('collapsed');
      toggleBtn.textContent = adminBody.classList.contains('collapsed') ? '▸' : '▾';
    });
  }

  // Admin tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.adminTab;
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = document.querySelector(`.admin-tab-content[data-admin-tab="${target}"]`);
      if (content) content.classList.add('active');
    });
  });
});

// ===== ADMIN PANEL — FULL LOGIC =====
let _brandsData = [];
let _selectedBrands = new Set();

function initAdminPanel() {
  loadBrands();
  setupUploadZone();
  setupBrandButtons();
}

// --- Brands tab ---
async function loadBrands() {
  const grid = document.getElementById('brandsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty"><div class="spinner"></div> Cargando marcas...</div>';

  try {
    const data = await apiCall('/api/admin/brands');
    _brandsData = data.brands || [];
    renderBrandsGrid();
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="color:var(--danger)">Error: ${err.message}</div>`;
  }
}

function renderBrandsGrid() {
  const grid = document.getElementById('brandsGrid');
  if (!grid || !_brandsData.length) return;

  grid.innerHTML = '';
  _brandsData.forEach(b => {
    const card = document.createElement('div');
    card.className = `brand-card${_selectedBrands.has(b.prefix) ? ' selected' : ''}`;
    card.dataset.prefix = b.prefix;

    const pctLabel = b.pctCosto !== null
      ? `C:${b.pctCosto}% G:${b.pctGanancia !== null ? b.pctGanancia : '?'}%`
      : 'Sin % definido';

    card.innerHTML = `
      <div class="brand-prefix">${b.prefix}</div>
      <div class="brand-count">${b.count} productos</div>
      <div class="brand-pct">${pctLabel}</div>
    `;

    card.addEventListener('click', () => {
      if (_selectedBrands.has(b.prefix)) _selectedBrands.delete(b.prefix);
      else _selectedBrands.add(b.prefix);
      card.classList.toggle('selected');
      updateBrandSelectionInfo();
    });

    grid.appendChild(card);
  });
  updateBrandSelectionInfo();
}

function updateBrandSelectionInfo() {
  const info = document.getElementById('brandSelectionInfo');
  if (!info) return;
  const count = _selectedBrands.size;
  const productCount = _brandsData
    .filter(b => _selectedBrands.has(b.prefix))
    .reduce((sum, b) => sum + b.count, 0);
  info.textContent = `${count} marca(s) seleccionada(s) (${productCount.toLocaleString()} productos)`;
}

function setupBrandButtons() {
  const selectAll = document.getElementById('selectAllBrands');
  const deselectAll = document.getElementById('deselectAllBrands');
  const applyBtn = document.getElementById('applyBrandPct');

  if (selectAll) selectAll.addEventListener('click', () => {
    _selectedBrands = new Set(_brandsData.map(b => b.prefix));
    document.querySelectorAll('.brand-card').forEach(c => c.classList.add('selected'));
    updateBrandSelectionInfo();
  });

  if (deselectAll) deselectAll.addEventListener('click', () => {
    _selectedBrands.clear();
    document.querySelectorAll('.brand-card').forEach(c => c.classList.remove('selected'));
    updateBrandSelectionInfo();
  });

  if (applyBtn) applyBtn.addEventListener('click', () => applyBrandPrices());
}

async function applyBrandPrices() {
  if (_selectedBrands.size === 0) return showToast('Seleccioná al menos una marca.', 'warning');
  const pctCosto = document.getElementById('brandPctCosto')?.value;
  const pctGan = document.getElementById('brandPctGan')?.value;
  if (pctCosto === '' && pctGan === '') return showToast('Ingresá al menos un %.', 'warning');

  const brands = [..._selectedBrands];
  const productCount = _brandsData.filter(b => _selectedBrands.has(b.prefix)).reduce((s, b) => s + b.count, 0);
  if (!confirm(`¿Aplicar % a ${brands.length} marca(s) (${productCount.toLocaleString()} productos)?`)) return;

  const resultEl = document.getElementById('adminBrandResult');
  const btn = document.getElementById('applyBrandPct');
  btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Aplicando...';

  try {
    const body = { mode: 'brands', brands };
    if (pctCosto !== '') body.pctCosto = Number(pctCosto);
    if (pctGan !== '') body.pctGanancia = Number(pctGan);

    const data = await apiCall('/api/admin/update-prices', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    resultEl.className = 'admin-result success';
    resultEl.textContent = `✓ ${data.message}`;
    resultEl.classList.remove('hidden');
    showToast('Precios actualizados por marca.', 'success');

    // Refresh: update local cache too
    await reloadProductsFromServer();
    loadBrands();
  } catch (err) {
    resultEl.className = 'admin-result error';
    resultEl.textContent = `✗ ${err.message}`;
    resultEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Aplicar a seleccionadas';
  }
}

// --- Upload tab ---
function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('excelUpload');
  const btn = document.getElementById('uploadBtn');
  if (!zone || !input) return;

  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleExcelUpload(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files.length) handleExcelUpload(input.files[0]); });
}

async function handleExcelUpload(file) {
  const statusEl = document.getElementById('uploadStatus');
  const statusText = document.getElementById('uploadStatusText');
  const resultEl = document.getElementById('adminUploadResult');
  resultEl.classList.add('hidden');

  if (!file.name.match(/\.xlsx?$/i)) return showToast('El archivo debe ser .xlsx o .xls', 'error');

  statusEl.classList.remove('hidden');
  statusText.textContent = 'Leyendo Excel...';

  try {
    // Wait for XLSX lib
    await waitForXLSX();
    const ab = await file.arrayBuffer();
    const products = parseExcel(ab);

    if (!products.length) throw new Error('El Excel no contiene productos válidos.');

    statusText.textContent = `Subiendo ${products.length.toLocaleString()} productos...`;

    // Send to API
    const data = await apiCall('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({ products })
    });

    resultEl.className = 'admin-result success';
    resultEl.textContent = `✓ ${data.message}`;
    resultEl.classList.remove('hidden');
    showToast(`${data.count.toLocaleString()} productos cargados.`, 'success');

    // Refresh local catalog
    await reloadProductsFromServer();
    loadBrands();

  } catch (err) {
    resultEl.className = 'admin-result error';
    resultEl.textContent = `✗ ${err.message}`;
    resultEl.classList.remove('hidden');
    showToast('Error al subir el Excel.', 'error');
  } finally {
    statusEl.classList.add('hidden');
  }
}

// --- Reload products from server API ---
async function reloadProductsFromServer() {
  try {
    const data = await apiCall('/api/products');
    if (data.products) {
      const prods = buildIndex(data.products);
      setProducts(prods);
      _cachedProducts = prods;
      updateStats(_cachedProducts.length, _cachedProducts.length, false);
      refreshFilteredAndPaginate(false);
    }
  } catch (err) {
    console.warn('No se pudo recargar desde API, usando Excel local:', err);
  }
}

// ===== CLEAR SEARCH =====
function updateClearButton() {
  const clearBtn = document.getElementById('clearSearch');
  if (clearBtn) clearBtn.classList.toggle('hidden', !searchInput.value.trim());
}
document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clearSearch');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      refreshFilteredAndPaginate(true);
      updateClearButton();
      searchInput.focus();
    });
  }
});

function updateStats(totalCount, filteredCount, isFiltered) {
  const statTotal = document.getElementById('statTotal');
  const statFiltered = document.getElementById('statFiltered');
  if (statTotal) statTotal.innerHTML = `📦 <b>${totalCount.toLocaleString()}</b> productos`;
  if (statFiltered) {
    if (isFiltered) { statFiltered.style.display = ''; statFiltered.innerHTML = `🔍 <b>${filteredCount.toLocaleString()}</b> resultados`; }
    else { statFiltered.style.display = 'none'; }
  }
}

async function waitForXLSX(maxAttempts = 50, delay = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    if (typeof XLSX !== 'undefined' && XLSX && typeof XLSX.read === 'function') return true;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
}

async function loadProductsAndRender(session) {
  let prods = null;
  setLoading(true);

  // 1. Intentar cargar desde la API (productos en Neon Postgres)
  try {
    const data = await apiCall('/api/products');
    if (data.products && data.products.length > 0) {
      console.log(`Catálogo cargado desde API: ${data.products.length} productos`);
      prods = buildIndex(data.products);
      setProducts(prods); // cache local
    }
  } catch (apiErr) {
    console.warn('API de productos no disponible, usando Excel local:', apiErr.message);
  }

  // 2. Fallback: cargar desde Excel local (para clientes o si la API falla)
  if (!prods || !prods.length) {
    try {
      const xlsxReady = await waitForXLSX();
      if (!xlsxReady) throw new Error('La librería XLSX no se cargó.');
      let lastModified = null, eTag = null, headOk = false;
      try {
        const headRes = await fetch(EXCEL_URL, { method: 'HEAD' });
        if (headRes.ok) { lastModified = headRes.headers.get('last-modified'); eTag = headRes.headers.get('etag'); headOk = true; }
      } catch (e) {}
      const prevMeta = JSON.parse(localStorage.getItem(PRODUCTS_META_KEY) || '{}');
      const hasLocal = !!getProducts();
      const changed = headOk ? ((lastModified && prevMeta.lastModified !== lastModified) || (eTag && prevMeta.eTag !== eTag) || !hasLocal) : !hasLocal;
      if (changed) {
        const res = await fetch(`${EXCEL_URL}?v=${Date.now()}`);
        if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        if (!ab || ab.byteLength === 0) throw new Error('Excel vacío.');
        let parsed = parseExcel(ab);
        if (!parsed.length) throw new Error('Excel sin productos válidos.');
        parsed = applyPctOverrides(parsed, getPctOverrides());
        prods = buildIndex(parsed);
        setProducts(prods);
        if (headOk) localStorage.setItem(PRODUCTS_META_KEY, JSON.stringify({ lastModified, eTag }));
      } else {
        prods = buildIndex(applyPctOverrides(getProducts() || [], getPctOverrides()));
      }
    } catch (e) {
      console.error('Error cargando productos:', e);
      prods = buildIndex(applyPctOverrides(getProducts() || [], getPctOverrides()));
      if (!prods.length) {
        const div = document.createElement('div');
        div.className = 'error-banner';
        div.innerHTML = `<strong>⚠️ Error al cargar el catálogo</strong><p>${e.message}</p>`;
        const av = document.getElementById('appView');
        if (av && !av.querySelector('.error-banner')) av.insertBefore(div, av.firstChild);
      }
    }
  }

  setLoading(false);
  _cachedProducts = prods || [];
  updateStats(_cachedProducts.length, _cachedProducts.length, false);
  if (session?.username) { try { syncCartPrices(session.username); } catch(e){} }
  renderCatalog(session);
  setupOrRefreshPagination();
}

function sortProducts(list, column, direction) {
  if (!column) return list;
  return [...list].sort((a, b) => {
    let aVal, bVal;
    switch(column) {
      case 'producto': aVal = normalize(a.producto||''); bVal = normalize(b.producto||''); break;
      case 'codigo': aVal = normalize(a.codigo||''); bVal = normalize(b.codigo||''); break;
      case 'precio_lista': aVal = toNumber(a.precio_lista); bVal = toNumber(b.precio_lista); break;
      case 'precio_costo': aVal = calcCosto(a.precio_lista,a.porcentaje_costo); bVal = calcCosto(b.precio_lista,b.porcentaje_costo); break;
      case 'precio_mostrador': aVal = calcMostrador(calcCosto(a.precio_lista,a.porcentaje_costo),a.porcentaje_ganancia); bVal = calcMostrador(calcCosto(b.precio_lista,b.porcentaje_costo),b.porcentaje_ganancia); break;
      default: return 0;
    }
    if (typeof aVal === 'string') return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });
}

function getCartCodesSet(username) {
  const cart = getCart(username);
  const set = new Set(); const qtyMap = {};
  (cart.items || []).forEach(it => { set.add(it.codigo); qtyMap[it.codigo] = toNumber(it.cantidad); });
  return { set, qtyMap };
}

function renderCatalog(session, listOverride=null) {
  const q = (searchInput.value || '').trim();
  let list = listOverride || computeFiltered(_cachedProducts, q);
  if (_sortColumn && list.length > 0) list = sortProducts(list, _sortColumn, _sortDirection);
  if (!list.length) {
    catalogBody.innerHTML = `<tr><td colspan="9"><div class="empty">${q ? `No se encontraron productos para "${q}".` : 'No hay productos disponibles.'}</div></td></tr>`;
    updateSortIndicators(); return;
  }
  const { set: cartSet, qtyMap } = session ? getCartCodesSet(session.username) : { set: new Set(), qtyMap: {} };
  let html = '';
  for (const p of list) {
    const pc = calcCosto(p.precio_lista, p.porcentaje_costo);
    const pm = calcMostrador(pc, p.porcentaje_ganancia);
    const inCart = cartSet.has(p.codigo);
    const badge = inCart ? `<span class="in-cart-badge">🛒 ${qtyMap[p.codigo]||0}</span>` : '';
    html += `<tr data-code="${p.codigo}"${inCart ? ' style="background:var(--green-subtle)"' : ''}>
      <td>${p.producto}${badge}</td><td>${p.codigo}</td>
      <td class="num">${fmt.format(p.precio_lista)}</td>
      <td class="num"><input class="inline-pct pct-costo" type="number" min="0" max="100" step="0.01" value="${toNumber(p.porcentaje_costo)}"/>%</td>
      <td class="num precio-costo">${fmt.format(pc)}</td>
      <td class="num"><input class="inline-pct pct-gan" type="number" min="0" max="300" step="0.01" value="${toNumber(p.porcentaje_ganancia)}"/>%</td>
      <td class="num precio-mostrador">${fmt.format(pm)}</td>
      <td class="num"><input class="qty-input" type="number" min="1" value="1"/></td>
      <td class="row-actions"><button class="btn-add">🛒 Agregar</button></td>
    </tr>`;
  }
  catalogBody.innerHTML = html;
  updateSortIndicators();
}

function updateSortIndicators() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === _sortColumn) th.classList.add(_sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
  });
}
function handleSort(column) {
  if (_sortColumn === column) _sortDirection = _sortDirection === 'asc' ? 'desc' : 'asc';
  else { _sortColumn = column; _sortDirection = 'asc'; }
  refreshFilteredAndPaginate(false);
}

// Cart
function addToCart(username, prod, qty) {
  const cart = getCart(username);
  const idx = cart.items.findIndex(i => i.codigo === prod.codigo);
  if (idx >= 0) cart.items[idx].cantidad += qty;
  else cart.items.push({ ...prod, cantidad: qty });
  setCart(username, cart);
}
function renderCartBadge(username) {
  const cart = getCart(username);
  cartCount.textContent = cart.items.reduce((acc, it) => acc + (toNumber(it.cantidad)||0), 0);
}
function clearCartAfterSend(username){
  setCart(username, { items: [] });
  renderCartBadge(username);
  if (cartModal && !cartModal.classList.contains('hidden')) {
    cartItems.innerHTML = `<div class="empty">El carrito está vacío.</div>`;
    subtotalView.textContent = fmt.format(0); totalView.textContent = fmt.format(0);
  }
}

// Fav lists
function ensureFavListsUI(){
  if (btnFavLists && !btnFavLists.__favBound) {
    btnFavLists.addEventListener('click', () => { const s = getSession(); if(!s) return; openFavLists(s.username); });
    btnFavLists.__favBound = true;
  }
  if (!document.getElementById('favListsModal')){
    const modal = document.createElement('div');
    modal.id = 'favListsModal'; modal.className = 'modal hidden';
    modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3>⭐ Listas favoritas</h3><button id="closeFavLists" class="icon-btn">✕</button></div>
      <div class="orders-body"><div id="favListsEmpty" class="empty hidden">No tenés listas guardadas.</div>
      <div class="table-wrap"><table class="catalog"><thead><tr><th>Nombre</th><th>Ítems</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody id="favListsBody"></tbody></table></div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end"><button id="btnSaveCurrentAsFav" class="secondary">⭐ Guardar carrito como lista</button></div></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('closeFavLists').addEventListener('click', () => { document.getElementById('favListsModal').classList.add('hidden'); document.body.style.overflow = ''; });
    document.getElementById('btnSaveCurrentAsFav').addEventListener('click', () => { const s = getSession(); if(s) saveCurrentCartAsFav(s.username); });
  }
}
function refreshFavLists(username){
  const lists = getFavLists(username); const tbody = document.getElementById('favListsBody'); const empty = document.getElementById('favListsEmpty');
  if (!tbody||!empty) return; tbody.innerHTML = '';
  if (!lists.length){ empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  lists.forEach(list => {
    const tr = document.createElement('tr');
    const count = (list.items||[]).reduce((a,it) => a + Math.max(1,toNumber(it.cantidad)), 0);
    tr.innerHTML = `<td>${list.name||'(sin nombre)'}</td><td class="num">${count}</td><td>${new Date(list.createdAt||Date.now()).toLocaleString()}</td>
      <td class="row-actions"><button class="secondary btn-load-fav" data-id="${list.id}">Cargar</button><button class="danger btn-del-fav" data-id="${list.id}">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-load-fav').forEach(b => b.addEventListener('click', e => { const s=getSession(); if(s) loadFavList(s.username, e.currentTarget.dataset.id); }));
  tbody.querySelectorAll('.btn-del-fav').forEach(b => b.addEventListener('click', e => { const s=getSession(); if(s) deleteFavList(s.username, e.currentTarget.dataset.id); }));
}
function openFavLists(u){ refreshFavLists(u); document.getElementById('favListsModal').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function saveCurrentCartAsFav(u){
  const cart = getCart(u); if(!cart.items?.length) return showToast('Carrito vacío.','warning');
  let name = (prompt('Nombre de la lista:')||'').trim(); if(!name) return;
  const lists = getFavLists(u); const idx = lists.findIndex(l => (l.name||'').toLowerCase()===name.toLowerCase());
  const p = { id: idx>=0?lists[idx].id:'L'+Date.now(), name, createdAt: new Date().toISOString(), items: cart.items };
  if(idx>=0) lists[idx]=p; else lists.unshift(p);
  setFavLists(u,lists); showToast(`Lista "${name}" guardada.`,'success'); refreshFavLists(u);
}
function loadFavList(u,id){
  const list = getFavLists(u).find(l=>l.id===id); if(!list) return;
  if(!confirm(`Reemplazar carrito con "${list.name}"?`)) return;
  setCart(u,{items:list.items||[]}); renderCartBadge(u);
  showToast(`Lista "${list.name}" cargada.`,'success');
  if(cartModal&&!cartModal.classList.contains('hidden')) openCart(u);
}
function deleteFavList(u,id){
  const list = getFavLists(u).find(l=>l.id===id); if(!list) return;
  if(!confirm(`¿Eliminar "${list.name}"?`)) return;
  setFavLists(u,getFavLists(u).filter(l=>l.id!==id)); showToast('Lista eliminada.','info'); refreshFavLists(u);
}

function openCart(username) {
  document.body.style.overflow = 'hidden';
  const cart = syncCartPrices(username) || getCart(username);
  cartModal.classList.remove('hidden'); cartItems.innerHTML = '';
  if (!cart.items.length) {
    cartItems.innerHTML = `<div class="empty">🛒 Carrito vacío.<br><small class="muted">Agregá productos desde el catálogo.</small></div>`;
    subtotalView.textContent = fmt.format(0); totalView.textContent = fmt.format(0); return;
  }
  let subtotal = 0;
  cart.items.forEach(raw => {
    const it = hydrateCartItem(raw);
    const pc = calcCosto(it.precio_lista, it.porcentaje_costo);
    const pm = calcMostrador(pc, it.porcentaje_ganancia);
    const qty = Math.max(1, toNumber(it.cantidad));
    subtotal += pc * qty;
    const row = document.createElement('div'); row.className = 'cart-item';
    row.innerHTML = `<h4>${it.producto} <span class="badge">${it.codigo}</span></h4>
      <div class="num">${fmt.format(pm)}</div><div class="num">${toNumber(it.porcentaje_costo)}%/${toNumber(it.porcentaje_ganancia)}%</div>
      <div class="num">${fmt.format(pc)}</div><div><input class="qtyChange qty-input" type="number" min="1" value="${qty}"/></div>
      <div class="row-actions"><button class="secondary btn-inc">+</button><button class="secondary btn-dec">−</button><button class="danger btn-del">✕</button></div>`;
    row.querySelector('.qtyChange').addEventListener('change', e => { updateQty(username,it.codigo,Math.max(1,toNumber(e.target.value))); openCart(username); renderCartBadge(username); });
    row.querySelector('.btn-inc').addEventListener('click', () => { updateQty(username,it.codigo,qty+1); openCart(username); renderCartBadge(username); });
    row.querySelector('.btn-dec').addEventListener('click', () => { updateQty(username,it.codigo,Math.max(1,qty-1)); openCart(username); renderCartBadge(username); });
    row.querySelector('.btn-del').addEventListener('click', () => { removeItem(username,it.codigo); openCart(username); renderCartBadge(username); });
    cartItems.appendChild(row);
  });
  subtotalView.textContent = fmt.format(Number(subtotal.toFixed(2)));
  totalView.textContent = fmt.format(Number(subtotal.toFixed(2)));
}
function updateQty(u,c,q){ const cart=getCart(u); const i=cart.items.findIndex(x=>x.codigo===c); if(i>=0){cart.items[i].cantidad=q;setCart(u,cart);} }
function removeItem(u,c){
  const cart=getCart(u); const it=cart.items.find(x=>x.codigo===c); if(!it) return;
  if(!confirm(`¿Eliminar "${it.producto}"?`)) return;
  cart.items=cart.items.filter(x=>x.codigo!==c); setCart(u,cart);
  showToast(`"${it.producto}" eliminado.`,'info'); refreshFilteredAndPaginate(false);
}

function buildCartExcelHtml(username, businessNameOverride) {
  const session = getSession() || {};
  const userName = session.email || session.username || username || '';
  const userBiz = (businessNameOverride != null ? String(businessNameOverride) : String(session.businessName || '')).trim();
  const exportDate = new Date();
  const cart = syncCartPrices(userName) || getCart(userName);
  const rows = (cart?.items || []).map(raw => {
    const it = hydrateCartItem(raw);
    const precio_costo = calcCosto(it.precio_lista, it.porcentaje_costo);
    const cantidad = Math.max(1, toNumber(it.cantidad));
    return { producto:it.producto, codigo:it.codigo, precio_lista:toNumber(it.precio_lista), porcentaje_costo:toNumber(it.porcentaje_costo), porcentaje_ganancia:toNumber(it.porcentaje_ganancia), precio_costo, cantidad, subtotal:Number((precio_costo*cantidad).toFixed(2)) };
  });
  const total = rows.reduce((a,r) => a+r.subtotal, 0);
  let meta = '<table border="1" style="margin-bottom:8px"><tr><th colspan="2" style="text-align:left;background:#eee">Datos de exportación</th></tr>';
  meta += `<tr><td>Fecha</td><td>${exportDate.toLocaleString()}</td></tr><tr><td>Usuario</td><td>${userName}</td></tr><tr><td>Negocio</td><td>${userBiz}</td></tr></table>`;
  let table = '<table border="1"><tr><th>Producto</th><th>Código</th><th>Cantidad</th></tr>';
  rows.forEach(r => { table += `<tr><td>${r.producto}</td><td>${r.codigo}</td><td>${r.cantidad}</td></tr>`; });
  table += '</table>';
  return { filename: `carrito_autopiezas_${exportDate.toISOString().slice(0,10)}.xls`, html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${meta}${table}</body></html>`, total };
}

// ===== EVENTS =====
document.getElementById('year').textContent = new Date().getFullYear();

// LOGIN via API
if (loginForm) loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Entrando...';
  try {
    const user = await handleLogin(loginUser.value, loginPass.value);
    showApp({ username: user.email, email: user.email, role: user.role, businessName: user.businessName });
    showToast(`Bienvenido, ${user.businessName || user.email}`, 'success');
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
});

// REGISTER via API
if (registerForm) registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('regBtn');
  const errEl = document.getElementById('regError');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Registrando...';
  try {
    const user = await handleRegister(regUser.value, regPass.value, regBiz.value);
    showApp({ username: user.email, email: user.email, role: user.role, businessName: user.businessName });
    showToast(`Cuenta creada. Bienvenido, ${user.businessName}!`, 'success');
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Registrarme';
  }
});

if (btnLogout) btnLogout.addEventListener('click', logout);

// Search
let searchTimer = null;
if (searchInput) searchInput.addEventListener('input', () => {
  setSearching(true); updateClearButton();
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { requestAnimationFrame(() => refreshFilteredAndPaginate(true)); }, 250);
});

// Enter on qty
if (catalogBody) catalogBody.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('qty-input')) { e.preventDefault(); const btn = e.target.closest('tr')?.querySelector('.btn-add'); if(btn) btn.click(); }
});

// Confirm Add
let _pendingConfirm = null;
function openConfirmAdd({ username, prod, addQty, btn }) {
  _pendingConfirm = { username, prod, addQty, btn };
  const existing = getCart(username).items.find(i => i.codigo === prod.codigo);
  confirmText.innerHTML = `Ya tenés <b>${prod.producto}</b> <span class="badge">${prod.codigo}</span>.<br/>Cantidad actual: <b>${existing ? Math.max(1,toNumber(existing.cantidad)) : 0}</b> · ¿Sumar <b>${addQty}</b> más?`;
  confirmModal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function closeConfirm() { confirmModal.classList.add('hidden'); _pendingConfirm = null; if(cartModal.classList.contains('hidden')) document.body.style.overflow = ''; }
if(confirmAddBtn) confirmAddBtn.addEventListener('click', () => { if(!_pendingConfirm) return closeConfirm(); const{username,prod,addQty,btn}=_pendingConfirm; addToCart(username,prod,addQty); renderCartBadge(username); triggerAddFeedback(btn,addQty); showToast(`+${addQty} ${prod.producto}`,'success'); closeConfirm(); refreshFilteredAndPaginate(false); });
if(confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirm);
if(confirmCloseBtn) confirmCloseBtn.addEventListener('click', closeConfirm);
if(confirmViewCartBtn) confirmViewCartBtn.addEventListener('click', () => { if(!_pendingConfirm) return closeConfirm(); const{username}=_pendingConfirm; closeConfirm(); openCart(username); });
window.addEventListener('keydown', e => { if(e.key==='Escape'){ if(!confirmModal.classList.contains('hidden')) closeConfirm(); else if(!cartModal.classList.contains('hidden')){cartModal.classList.add('hidden');document.body.style.overflow='';} }});

// Table click delegation
if(catalogBody) catalogBody.addEventListener('click', e => {
  const session=getSession(); if(!session) return;
  const btn=e.target.closest('.btn-add'); if(!btn) return;
  const tr=btn.closest('tr'); const code=tr?.dataset.code; if(!code) return;
  const p=_cachedProducts.find(x=>x.codigo===code); if(!p) return;
  const qty=Math.max(1,toNumber(tr.querySelector('.qty-input')?.value||1));
  if(getCart(session.username).items.some(i=>i.codigo===p.codigo)){
    openConfirmAdd({username:session.username,prod:{...p},addQty:qty,btn});
  } else {
    addToCart(session.username,{...p},qty); renderCartBadge(session.username); triggerAddFeedback(btn,qty);
    showToast(`${p.producto} agregado`,'success'); refreshFilteredAndPaginate(false);
  }
});

// Inline % edit
if(catalogBody) catalogBody.addEventListener('input', e => {
  const t=e.target; if(!t) return; const tr=t.closest('tr'); if(!tr) return;
  const code=tr.dataset.code; const idx=_cachedProducts.findIndex(x=>x.codigo===code); if(idx<0) return;
  if(t.classList.contains('pct-costo')||t.classList.contains('pct-gan')){
    if(t.classList.contains('pct-costo')) _cachedProducts[idx].porcentaje_costo=toNumber(t.value);
    if(t.classList.contains('pct-gan')) _cachedProducts[idx].porcentaje_ganancia=toNumber(t.value);
    upsertPctOverride(code,_cachedProducts[idx].porcentaje_costo,_cachedProducts[idx].porcentaje_ganancia);
    setProducts(_cachedProducts);
    const p=_cachedProducts[idx]; const nc=calcCosto(p.precio_lista,p.porcentaje_costo); const nm=calcMostrador(nc,p.porcentaje_ganancia);
    const ce=tr.querySelector('.precio-costo'); const me=tr.querySelector('.precio-mostrador');
    if(ce) ce.textContent=fmt.format(nc); if(me) me.textContent=fmt.format(nm);
  }
});

if(btnCart) btnCart.addEventListener('click', ()=>{ const s=getSession(); if(s) openCart(s.username); });
if(closeCart) closeCart.addEventListener('click', ()=>{ cartModal.classList.add('hidden'); document.body.style.overflow=''; refreshFilteredAndPaginate(false); });

if(btnExportExcel) btnExportExcel.addEventListener('click', ()=>{
  const s=getSession(); const biz=getBusinessName(); if(biz==null) return;
  const{html,filename}=buildCartExcelHtml(s.username,biz);
  const blob=new Blob([html],{type:'application/vnd.ms-excel'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('Excel exportado.','success');
});

if(btnClearCart) btnClearCart.addEventListener('click', ()=>{
  const s=getSession(); if(!s) return;
  const cart=getCart(s.username); if(!cart.items.length) return showToast('Carrito vacío.','info');
  if(!confirm(`¿Vaciar? ${cart.items.length} artículo(s).`)) return;
  setCart(s.username,{items:[]}); openCart(s.username); renderCartBadge(s.username);
  showToast('Carrito vaciado.','info'); refreshFilteredAndPaginate(false);
});

// Global %
if(applyGlobalAll) applyGlobalAll.addEventListener('click', async ()=>{
  const nc=globalPctCosto.value, ng=globalPctGan.value;
  if(nc===''&&ng==='') return showToast('Ingresá al menos un %.','warning');
  const session = getSession();
  const isAdmin = session?.role === 'admin';

  if(isAdmin) {
    if(!confirm(`¿Aplicar % a TODOS los productos del catálogo?`)) return;
    applyGlobalAll.disabled=true; applyGlobalAll.innerHTML='<span class="btn-spinner"></span> Aplicando...';
    try {
      const body = { mode: 'all' };
      if(nc!=='') body.pctCosto = Number(nc);
      if(ng!=='') body.pctGanancia = Number(ng);
      await apiCall('/api/admin/update-prices', { method:'POST', body:JSON.stringify(body) });
      await reloadProductsFromServer();
      if(typeof loadBrands==='function') loadBrands();
      const resultEl=document.getElementById('adminPriceResult');
      if(resultEl){resultEl.className='admin-result success';resultEl.textContent='✓ Porcentajes actualizados en TODOS los productos.';resultEl.classList.remove('hidden');}
      showToast('% actualizados en TODOS (guardado en servidor).','success');
    } catch(err) {
      showToast('Error: '+err.message,'error');
    } finally {
      applyGlobalAll.disabled=false; applyGlobalAll.textContent='Aplicar a TODOS';
    }
  } else {
    // Cliente: solo local
    const map=getPctOverrides();
    _cachedProducts.forEach(p=>{
      if(nc!=='') p.porcentaje_costo=toNumber(nc); if(ng!=='') p.porcentaje_ganancia=toNumber(ng);
      map[p.codigo]={costo:p.porcentaje_costo,gan:p.porcentaje_ganancia};
    });
    setPctOverrides(map); setProducts(_cachedProducts); renderCatalog(session); setupOrRefreshPagination();
    showToast('% actualizados en TODOS (local).','success');
  }
});
if(applyGlobalFiltered) applyGlobalFiltered.addEventListener('click', async ()=>{
  const nc=globalPctCosto.value, ng=globalPctGan.value;
  if(nc===''&&ng==='') return showToast('Ingresá al menos un %.','warning');
  const q=(searchInput.value||'').trim();
  const session = getSession();
  const isAdmin = session?.role === 'admin';

  if(isAdmin && q) {
    if(!confirm(`¿Aplicar % a los productos filtrados por "${q}"?`)) return;
    applyGlobalFiltered.disabled=true; applyGlobalFiltered.innerHTML='<span class="btn-spinner"></span> Aplicando...';
    try {
      const body = { mode: 'search', search: q };
      if(nc!=='') body.pctCosto = Number(nc);
      if(ng!=='') body.pctGanancia = Number(ng);
      await apiCall('/api/admin/update-prices', { method:'POST', body:JSON.stringify(body) });
      await reloadProductsFromServer();
      if(typeof loadBrands==='function') loadBrands();
      const resultEl=document.getElementById('adminPriceResult');
      if(resultEl){resultEl.className='admin-result success';resultEl.textContent=`✓ Porcentajes actualizados en productos filtrados por "${q}".`;resultEl.classList.remove('hidden');}
      showToast('% actualizados en filtrados (guardado en servidor).','success');
    } catch(err) {
      showToast('Error: '+err.message,'error');
    } finally {
      applyGlobalFiltered.disabled=false; applyGlobalFiltered.textContent='Aplicar a FILTRADOS';
    }
  } else {
    // Cliente o sin filtro: local
    const filtered=computeFiltered(_cachedProducts,q);
    if(!filtered.length) return showToast('Sin productos filtrados.','warning');
    const map=getPctOverrides();
    filtered.forEach(p=>{
      if(nc!=='') p.porcentaje_costo=toNumber(nc); if(ng!=='') p.porcentaje_ganancia=toNumber(ng);
      map[p.codigo]={costo:p.porcentaje_costo,gan:p.porcentaje_ganancia};
    });
    setPctOverrides(map); setProducts(_cachedProducts); refreshFilteredAndPaginate(false);
    showToast(`% actualizados en ${filtered.length} filtrados.`,'success');
  }
});

// Sort
let _sortListenersSetup=false;
function setupSortListeners(){
  if(_sortListenersSetup) return;
  const tw=document.querySelector('.table-wrap'); if(!tw){setTimeout(setupSortListeners,100);return;}
  tw.addEventListener('click', e=>{ const th=e.target.closest('th.sortable'); if(!th) return; e.preventDefault(); const col=th.dataset.sort; if(col) handleSort(col); });
  _sortListenersSetup=true;
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
  // Verify existing session against API
  const session = await verifySession();
  if (session) {
    showApp(session);
  } else {
    showAuth();
  }
  ensureOrdersUI();
  setupSortListeners();
});

// Pagination
let _filteredCache=[]; let _currentPage=1; const PAGE_SIZE=100;
let _sortColumn=null; let _sortDirection='asc';

function renderPaginationControls(){
  const c=document.getElementById('pagination'); if(!c) return;
  const total=_filteredCache.length; const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const safe=Math.min(Math.max(1,_currentPage),pages); const start=(safe-1)*PAGE_SIZE+1; const end=Math.min(safe*PAGE_SIZE,total);
  c.innerHTML='';
  const ind=document.createElement('div'); ind.className='page-indicator';
  ind.textContent=`${total?start:0}–${total?end:0} de ${total} · Pág. ${safe}/${pages}`; c.appendChild(ind);
  const mk=(l,fn,d)=>{ const b=document.createElement('button'); b.className='page-btn'; b.textContent=l; if(d)b.disabled=true; b.addEventListener('click',fn); return b; };
  c.appendChild(mk('«',()=>renderPage(1),_currentPage===1));
  c.appendChild(mk('‹',()=>renderPage(_currentPage-1),_currentPage===1));
  c.appendChild(mk('›',()=>renderPage(_currentPage+1),_currentPage>=pages));
  c.appendChild(mk('»',()=>renderPage(pages),_currentPage>=pages));
}
function renderPage(n){
  const s=getSession(); const pages=Math.max(1,Math.ceil(_filteredCache.length/PAGE_SIZE));
  _currentPage=Math.min(Math.max(1,n),pages);
  renderCatalog(s,_filteredCache.slice((_currentPage-1)*PAGE_SIZE,_currentPage*PAGE_SIZE));
  renderPaginationControls();
  document.querySelector('.table-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function refreshFilteredAndPaginate(reset=true){
  const q=(searchInput.value||'').trim();
  let f=computeFiltered(_cachedProducts,q);
  if(_sortColumn) f=sortProducts(f,_sortColumn,_sortDirection);
  _filteredCache=f; if(reset) _currentPage=1; renderPage(_currentPage); setSearching(false);
  updateStats(_cachedProducts.length,f.length,!!q);
}
function setupOrRefreshPagination(){ refreshFilteredAndPaginate(false); }

// === GAS / Email ===
const AS_API_URL='https://script.google.com/macros/s/AKfycbyFfWchsSZ_h9uEgKiJZEuM6-ZE17eoMx4fvji_W0kf3kPy-kHD7p9GpPAJiAwACCft/exec';
const SALES_EMAIL='autopiezassalamanca@hotmail.com';
const WHATSAPP_TARGET='5491124067789';
const DRIVE_FOLDER_ID='1o4Z7w4dTsuag2LSd97EuMtVzpqBQBaqU';

function postToGAS(payload,blank=true){
  const form=document.createElement('form'); form.action=AS_API_URL; form.method='POST'; if(blank)form.target='_blank';
  for(const[k,v] of Object.entries(payload)){const inp=document.createElement('input');inp.type='hidden';inp.name=k;inp.value=typeof v==='string'?v:JSON.stringify(v);form.appendChild(inp);}
  document.body.appendChild(form); form.submit(); form.remove();
}

// Business name — now from session (DB-backed)
function getBusinessName(){
  const s=getSession(); if(!s) return null;
  if(s.businessName) return s.businessName;
  const name=(prompt('Ingresá el NOMBRE DEL NEGOCIO:')||'').trim();
  if(!name) return null;
  setSession({...s, businessName:name});
  return name;
}

function sendEmailCORSFree(provider){
  const s=getSession(); if(!s) return showToast('Debés iniciar sesión.','error');
  const biz=getBusinessName(); if(!biz) return;
  const data=buildCartExcelHtml(s.username,biz);
  postToGAS({
    route:'email', to:SALES_EMAIL,
    subject:`Pedido - ${biz} (${new Date().toLocaleDateString()})`,
    bodyHtml:`<p>Pedido de:</p><p><b>Email:</b> ${s.email||s.username}</p><p><b>Negocio:</b> ${biz}</p><p><b>Total (costo):</b> ${fmt.format(Number(data.total.toFixed(2)))}</p>`,
    filename:data.filename, html:data.html
  }, true);
  try{ saveOrder(s.username, buildOrderSnapshot(s.username, provider||'Email')); }catch(e){}
  finally{ clearCartAfterSend(s.username); }
  showToast('Pedido enviado.','success'); refreshFilteredAndPaginate(false);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const g=document.getElementById('btnSendGmail'); if(g){g.textContent='📧 Finalizar y enviar'; g.addEventListener('click',()=>sendEmailCORSFree('Email'));}
  const w=document.getElementById('btnSendWhatsApp'); if(w) w.addEventListener('click',()=>{
    const s=getSession(); if(!s) return; const biz=getBusinessName(); if(!biz) return;
    const data=buildCartExcelHtml(s.username);
    postToGAS({route:'uploadAndRedirect',folderId:DRIVE_FOLDER_ID,filename:data.filename,html:data.html,whatsappTarget:WHATSAPP_TARGET,mensaje:`${s.email} | ${biz} | Total: ${fmt.format(Number(data.total.toFixed(2)))}`},true);
    try{saveOrder(s.username,buildOrderSnapshot(s.username,'WhatsApp'));}catch(e){}
  });
});

function triggerAddFeedback(btn,qty){
  if(!btn) return; btn.classList.remove('do-ripple'); void btn.offsetWidth; btn.classList.add('do-ripple');
  const b=document.createElement('span'); b.className='add-badge'; b.textContent=`+${qty}`;
  btn.appendChild(b); b.addEventListener('animationend',()=>b.remove(),{once:true});
}

function getProducts(){ try{return JSON.parse(localStorage.getItem(PRODUCTS_KEY));}catch{return null;} }
function setProducts(list){ localStorage.setItem(PRODUCTS_KEY,JSON.stringify(list)); }
function getCart(u){ try{return JSON.parse(localStorage.getItem(CART_KEY_PREFIX+u))||{items:[]};}catch{return{items:[]};} }
function setCart(u,c){ localStorage.setItem(CART_KEY_PREFIX+u,JSON.stringify(c)); }

function parseExcel(ab){
  if(typeof XLSX==='undefined'||!XLSX?.read) throw new Error('XLSX no cargada.');
  let wb; try{wb=XLSX.read(ab,{type:'array'});}catch(e){throw new Error(`Error Excel: ${e.message}`);}
  if(!wb.SheetNames?.length) throw new Error('Excel sin hojas.');
  const ws=wb.Sheets[wb.SheetNames[0]]; if(!ws) throw new Error('Hoja no legible.');
  let json; try{json=XLSX.utils.sheet_to_json(ws,{raw:false,defval:''});}catch(e){throw new Error(`Conversión: ${e.message}`);}
  if(!json?.length) return [];
  const hm={}; const fr=json[0];
  Object.keys(fr).forEach(k=>{
    const n=k.trim().toLowerCase().replace(/[\s_-]/g,'');
    if(n.includes('codigo')) hm.codigo=k;
    else if(n.includes('producto')) hm.producto=k;
    else if(n.includes('preciolista')||n.includes('precio_lista')) hm.precio_lista=k;
  });
  const miss=['codigo','producto','precio_lista'].filter(r=>!hm[r]);
  if(miss.length) throw new Error(`Faltan columnas: ${miss.join(', ')}`);
  const rows=[];
  for(const row of json){
    const p=(row[hm.producto]||'').toString().trim(); const c=(row[hm.codigo]||'').toString().trim();
    if(!p||!c) continue;
    rows.push({producto:p,codigo:c,precio_lista:toNumber(row[hm.precio_lista])});
  }
  return rows;
}
