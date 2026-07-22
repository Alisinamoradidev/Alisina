const DEPOSIT_AMOUNT = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.depositAmount) || 1000;
let properties = [];

function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadPropertiesFromApi() {
  try {
    const res = await fetch(`${API_URL}/api/properties`);
    if (!res.ok) return hideSkeletons();
    const data = await res.json();
    if (data && data.length > 0) {
      properties = data.map(p => {
        if (typeof p.gallery === 'string') { try { p.gallery = JSON.parse(p.gallery); } catch(e) { p.gallery = []; } }
        if (!Array.isArray(p.gallery)) p.gallery = [];
        return p;
      });
      updateListings();
      renderSoldProperties();
      if (typeof L !== 'undefined') initMap(); else tryInitMap();
    }
    hideSkeletons();
  } catch { hideSkeletons(); }
}

function renderSoldProperties() {
  const grid = document.getElementById('soldGrid');
  const empty = document.getElementById('soldEmpty');
  const sold = properties.filter(p => p.badge === 'sold');
  if (!sold.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = sold.map((p, i) => `
    <div class="property-card" style="--i:${i}" data-id="${p.id}">
      <div class="property-image">
        <img src="${p.image}" alt="${sanitizeHTML(p.title)}" loading="lazy">
        <span class="property-badge badge-sold">Sold</span>
      </div>
      <div class="property-body">
        <div class="property-price" style="color:var(--text-muted);text-decoration:line-through">${formatPrice(p.price, 'sale')}</div>
        <div class="property-title">${sanitizeHTML(p.title)}</div>
        <div class="property-location">${I('fas fa-map-marker-alt')} ${sanitizeHTML(p.location)}</div>
        <div class="property-details">
          <span>${I('fas fa-bed')} ${p.beds} Beds</span>
          <span>${I('fas fa-bath')} ${p.baths} Baths</span>
          <span>${I('fas fa-ruler-combined')} ${p.sqft.toLocaleString()} sqft</span>
        </div>
      </div>
    </div>
  `).join('');
}
function hideSkeletons() { document.querySelectorAll('.skeleton-card').forEach(e => e.remove()); }

const $ = id => document.getElementById(id);
const IM={'fas fa-map-marker-alt':'location-dot','fas fa-bed':'bed','fas fa-bath':'bath','fas fa-ruler-combined':'ruler-combined','fas fa-camera':'camera','far fa-heart':'heart-outline','fas fa-heart':'heart-solid','fas fa-times':'xmark','fas fa-credit-card':'credit-card','fas fa-star':'star','fas fa-chevron-left':'chevron-left','fas fa-chevron-right':'chevron-right','fas fa-arrow-right':'arrow-right','fas fa-calendar':'calendar','fas fa-check-circle':'circle-check','fas fa-plus-circle':'circle-plus','fas fa-external-link-alt':'arrow-up-right-from-square'};
function I(c){return'<svg aria-hidden="true" focusable="false" class="'+c+'"><use href="#'+IM[c]+'"/></svg>';}

/* Load contact info from backend and update all hardcoded values */
async function loadContactInfo() {
  try {
    const r = await fetch(`${API_URL}/api/settings/contact?_t=${Date.now()}`);
    if (!r.ok) return;
    const c = await r.json();
    if (!c || typeof c !== 'object') return;

    const phone = c.phone || SITE_CONFIG.phone;
    const email = c.email || SITE_CONFIG.email;
    const address = c.address || SITE_CONFIG.address;
    const whatsapp = c.whatsapp || phone;
    const waMsg = encodeURIComponent(c.whatsapp_message || 'Hi, I\'m interested in your properties');
    const fb = c.facebook_url || '#';
    const ig = c.instagram_url || '#';
    const li = c.linkedin_url || '#';

    /* WhatsApp button */
    const waBtn = document.querySelector('.whatsapp-btn');
    if (waBtn) waBtn.href = `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}?text=${waMsg}`;

    /* Contact section info */
    const emailEl = document.querySelector('[data-contact="email"]');
    const phoneEl = document.querySelector('[data-contact="phone"]');
    const addressEl = document.querySelector('[data-contact="address"]');
    if (emailEl) emailEl.textContent = email;
    if (phoneEl) phoneEl.textContent = phone;
    if (addressEl) addressEl.textContent = address;

    /* Contact form action */
    const contactForm = document.getElementById('contactForm');
    if (contactForm) contactForm.removeAttribute('action');

    /* Footer social links */
    const socialLinks = document.querySelectorAll('.footer-social .social-icons a');
    if (socialLinks.length >= 3) {
      if (fb !== '#') socialLinks[0].href = fb;
      if (ig !== '#') socialLinks[1].href = ig;
      if (li !== '#') socialLinks[2].href = li;
    }
  } catch {}
}

const listingsGrid = $('listingsGrid');
const noResults = $('noResults');
const resultsCount = $('resultsCount');
const searchInput = $('searchInput');
const priceFilter = $('priceFilter');
const typeFilter = $('typeFilter');
const sortSelect = $('sortSelect');
const nav = $('nav');
const contactForm = $('contactForm');
const modalOverlay = $('modalOverlay');
const scrollTop = $('scrollTop');
let favorites = new Set(JSON.parse(localStorage.getItem('favs') || '[]'));
let currentPage = 1;
const pageSize = 6;
let compareItems = [];

function formatPrice(price, badge) {
  if (badge === 'rent') return `$${price.toLocaleString()}/mo`;
  return price >= 1000000 ? `$${(price / 1000000).toFixed(1)}M` : `$${price.toLocaleString()}`;
}

function getDescription(type) {
  const desc = {
    house: "This stunning home features an open floor plan with abundant natural light, modern finishes throughout, and a spacious backyard perfect for entertaining.",
    apartment: "This stylish apartment offers contemporary living in the heart of the city. Features include hardwood floors, in-unit laundry, and a private balcony with skyline views.",
    condo: "This beautifully maintained condo offers resort-style living with top-of-the-line amenities. Enjoy the community pool, gym, and 24-hour concierge service.",
    villa: "Experience luxury living in this exquisite villa featuring Mediterranean architecture, private pool, landscaped gardens, and premium finishes throughout."
  };
  return desc[type] || "This beautiful property offers modern finishes and an open floor plan.";
}

function setFavIcon(btn, id) {
  const use = btn.querySelector('use');
  if (use) { use.setAttribute('href', favorites.has(id) ? '#heart-solid' : '#heart-outline'); return; }
  const icon = btn.querySelector('i');
  if (icon) icon.className = favorites.has(id) ? 'fas fa-heart' : 'far fa-heart';
}

function createPropertyCard(p, idx = 0) {
  const card = document.createElement('div');
  card.className = 'property-card';
  card.dataset.id = p.id;
  card.style.setProperty('--i', idx);
  card.innerHTML = `
    <div class="property-image">
      <img src="${p.image}" alt="${sanitizeHTML(p.title)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22><rect fill=%22%23d1d5db%22 width=%22600%22 height=%22400%22/><text fill=%22%236b7280%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>No Image</text></svg>'">
      <span class="property-badge ${p.badge === 'sold' ? 'badge-sold' : p.badge === 'sale' ? 'badge-sale' : 'badge-rent'}">${p.badge === 'sold' ? 'Sold' : p.badge === 'sale' ? 'For Sale' : 'For Rent'}</span>
      <span class="photo-count">${I('fas fa-camera')} ${p.gallery && p.gallery.length > 0 ? p.gallery.length + 1 : 1}</span>
      <button class="property-fav" data-id="${p.id}" aria-label="Save property">${I('far fa-heart')}</button>
    </div>
      <div class="property-body">
      <div class="property-price">${formatPrice(p.price, p.badge)}</div>
      <div class="property-title">${sanitizeHTML(p.title)}</div>
      <div class="property-location">${I('fas fa-map-marker-alt')} ${sanitizeHTML(p.location)}</div>
      <div class="property-details">
        <span>${I('fas fa-bed')} ${p.beds} Beds</span>
        <span>${I('fas fa-bath')} ${p.baths} Baths</span>
        <span>${I('fas fa-ruler-combined')} ${p.sqft.toLocaleString()} sqft</span>
      </div>
      <button class="btn-compare" data-id="${p.id}" onclick="toggleCompare(${p.id})" title="Compare">${I(`fas ${compareItems.includes(p.id) ? 'fa-check-circle' : 'fa-plus-circle'}`)}</button>
    </div>`;
  setFavIcon(card.querySelector('.property-fav'), p.id);
  return card;
}

function toggleCompare(id) {
  const idx = compareItems.indexOf(id);
  if (idx > -1) { compareItems.splice(idx, 1); } else { if (compareItems.length >= 4) return alert('Compare up to 4 properties'); compareItems.push(id); }
  updateListings();
  renderCompareBar();
}

function renderCompareBar() {
  const bar = document.getElementById('compareBar');
  if (!compareItems.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const inner = bar.querySelector('.compare-bar-inner');
  const items = compareItems.map(id => properties.find(p => p.id === id)).filter(Boolean);
  inner.innerHTML = items.map(p => `
    <div class="compare-chip"><span>${sanitizeHTML(p.title)}</span><span onclick="toggleCompare(${p.id})" style="cursor:pointer">${I('fas fa-times')}</span></div>
  `).join('');
  const btn = bar.querySelector('.compare-btn');
  btn.style.display = items.length >= 2 ? 'inline-flex' : 'none';
}

function openCompare() {
  const items = compareItems.map(id => properties.find(p => p.id === id)).filter(Boolean);
  if (items.length < 2) return;
  const labels = ['Price','Type','Beds','Baths','Sqft','Year Built','Location'];
  const keys = [p => formatPrice(p.price, p.badge), p => sanitizeHTML(p.type), p => p.beds, p => p.baths, p => p.sqft.toLocaleString(), p => p.year || '—', p => sanitizeHTML(p.location)];
  let html = '<table class="compare-table"><thead><tr><th></th>' + items.map(p => `<th><img src="${p.image}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px"><br>${sanitizeHTML(p.title)}</th>`).join('') + '</tr></thead><tbody>';
  labels.forEach((label, i) => {
    html += `<tr><td><strong>${label}</strong></td>` + items.map(p => `<td>${keys[i](p)}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('compareModalBody').innerHTML = html;
  document.getElementById('compareModal').style.display = 'flex';
}
function closeCompare() { document.getElementById('compareModal').style.display = 'none'; }

function matchesPrice(price, filter) {
  if (!filter) return true;
  const [min, max] = filter.split('-').map(Number);
  return price >= min && price <= max;
}

function sortProperties(list, sortBy) {
  const sorted = [...list];
  if (sortBy === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sortBy === 'name-asc') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === 'name-desc') sorted.sort((a, b) => b.title.localeCompare(a.title));
  return sorted;
}

function renderProperties(list) {
  listingsGrid.innerHTML = '';
  if (list.length === 0) { noResults.classList.add('visible'); resultsCount.textContent = 'No properties found'; document.getElementById('pagination').style.display = 'none'; return; }
  noResults.classList.remove('visible');
  const totalPages = Math.ceil(list.length / pageSize);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const start = (currentPage - 1) * pageSize;
  const pageItems = list.slice(start, start + pageSize);
  resultsCount.textContent = `Showing ${start + 1}–${Math.min(start + pageSize, list.length)} of ${list.length} properties`;
  pageItems.forEach((p, i) => listingsGrid.appendChild(createPropertyCard(p, i)));
  renderPagination(totalPages, list);
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.property-card');
    const len = cards.length;
    for (let i = 0; i < len; i++) {
      cards[i].classList.add('visible');
    }
  });
}

function renderPagination(totalPages) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
  const nums = document.getElementById('pageNumbers');
  nums.innerHTML = '';
  const range = 2;
  const start = Math.max(1, currentPage - range);
  const end = Math.min(totalPages, currentPage + range);
  if (start > 1) { nums.appendChild(pageNum(1)); if (start > 2) nums.appendChild(ellipsis()); }
  for (let i = start; i <= end; i++) nums.appendChild(pageNum(i));
  if (end < totalPages) { if (end < totalPages - 1) nums.appendChild(ellipsis()); nums.appendChild(pageNum(totalPages)); }
}

function pageNum(n) {
  const btn = document.createElement('button');
  btn.className = `page-num${n === currentPage ? ' active' : ''}`;
  btn.textContent = n;
  btn.onclick = () => { currentPage = n; updateListings(); };
  return btn;
}

function ellipsis() { const s = document.createElement('span'); s.className = 'page-dots'; s.textContent = '...'; return s; }

function goToPage(n) { currentPage = n; updateListings(); }

function getFilteredAndSorted() {
  const q = searchInput.value.toLowerCase().trim();
  const pv = priceFilter.value;
  const tv = typeFilter.value;
  const sv = sortSelect.value;
  const bv = parseInt(document.getElementById('bedsFilter')?.value) || 0;
  const baw = parseInt(document.getElementById('bathsFilter')?.value) || 0;
  let filtered = properties.filter(p => {
    if (p.status === 'deposited' || p.status === 'rented') return false;
    const ms = !q || p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
    return ms && matchesPrice(p.price, pv) && (!tv || p.type === tv) && p.beds >= bv && p.baths >= baw;
  });
  return sortProperties(filtered, sv);
}

function updateListings() { renderProperties(getFilteredAndSorted()); }

$('searchForm').addEventListener('submit', e => { e.preventDefault(); currentPage = 1; updateListings(); });
document.getElementById('bedsFilter')?.addEventListener('change', () => { currentPage = 1; updateListings(); });
document.getElementById('bathsFilter')?.addEventListener('change', () => { currentPage = 1; updateListings(); });
[searchInput, priceFilter, typeFilter, sortSelect].forEach(el => { el.addEventListener('input', () => { currentPage = 1; updateListings(); }); el.addEventListener('change', () => { currentPage = 1; updateListings(); }); });

listingsGrid.addEventListener('click', e => {
  const favBtn = e.target.closest('.property-fav');
  if (favBtn) {
    e.stopPropagation();
    const id = Number(favBtn.dataset.id);
    const wasFav = favorites.has(id);
    wasFav ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    setFavIcon(favBtn, id);
    showToast(wasFav ? 'Removed from favorites' : 'Added to favorites');
    return;
  }
  const card = e.target.closest('.property-card');
  if (card) { const p = properties.find(x => x.id === Number(card.dataset.id)); if (p) openModal(p); }
});

function openModal(p) {
  $('modalImage').innerHTML = `<img src="${p.image.replace('w=600', 'w=800')}" alt="${sanitizeHTML(p.title)}">`;
  $('modalTitle').textContent = p.title;
  $('modalPrice').textContent = formatPrice(p.price, p.badge);
  $('modalLocation').querySelector('span').textContent = p.location;
  const mapLink = $('modalMapLink');
  const modalMapEl = $('modalMap');
  if (p.lat && p.lng) { mapLink.href = `https://www.google.com/maps?q=${p.lat},${p.lng}`; mapLink.style.display = ''; modalMapEl.style.display = ''; loadLeafletScript().then(() => { setTimeout(() => { if (window._modalMap) { window._modalMap.remove(); } window._modalMap = L.map(modalMapEl, { zoomControl: false }).setView([p.lat, p.lng], 15); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(window._modalMap); L.marker([p.lat, p.lng]).addTo(window._modalMap); setTimeout(() => window._modalMap.invalidateSize(), 100); }, 100); }).catch(() => {}); } else { mapLink.style.display = 'none'; modalMapEl.style.display = 'none'; }
  $('modalDetails').innerHTML = `<span>${I('fas fa-bed')} ${p.beds} Beds</span><span>${I('fas fa-bath')} ${p.baths} Baths</span><span>${I('fas fa-ruler-combined')} ${p.sqft.toLocaleString()} sqft</span><span>${I('fas fa-calendar')} Built ${p.year}</span>`;
  $('modalDescription').textContent = getDescription(p.type);
  const mf = $('modalFav'), use = mf.querySelector('use');
  if (use) { use.setAttribute('href', favorites.has(p.id) ? '#heart-solid' : '#heart-outline'); } else { const icon = mf.querySelector('i'); if (icon) icon.className = favorites.has(p.id) ? 'fas fa-heart' : 'far fa-heart'; }
  if (favorites.has(p.id)) mf.classList.add('saved'); else mf.classList.remove('saved');
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  mf.onclick = () => {
    favorites.has(p.id) ? favorites.delete(p.id) : favorites.add(p.id);
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    const icu = mf.querySelector('use');
    if (icu) { icu.setAttribute('href', favorites.has(p.id) ? '#heart-solid' : '#heart-outline'); } else { const ic = mf.querySelector('i'); if (ic) ic.className = favorites.has(p.id) ? 'fas fa-heart' : 'far fa-heart'; }
    const cf = document.querySelector(`.property-fav[data-id="${p.id}"]`);
    if (cf) setFavIcon(cf, p.id);
    showToast(favorites.has(p.id) ? 'Added to favorites' : 'Removed from favorites');
  };
  /* Payment button */
  const payBtn = $('modalPay');
  const bankInfoDiv = $('bankInfo');
  const bankDetails = $('bankInfoDetails');
  const rentalDiv = $('rentalDuration');
  const durationOpts = $('durationOptions');
  rentalDiv.style.display = 'none';
  if (p.badge === 'sale') {
    payBtn.innerHTML = `${I('fas fa-credit-card')} Pay $${DEPOSIT_AMOUNT.toLocaleString()} Deposit`;
    payBtn.style.display = '';
    payBtn._payType = 'deposit';
    payBtn._propId = p.id;
    payBtn._payDuration = '';
  } else if (p.badge === 'rent') {
    payBtn.style.display = 'none';
    rentalDiv.style.display = 'block';
    const durations = [
      { key: '1month', label: '1 Month', months: 1 },
      { key: '6months', label: '6 Months', months: 6 },
      { key: '1year', label: '1 Year', months: 12 },
    ];
    durationOpts.innerHTML = durations.map(d => {
      const total = p.price * d.months;
      const monthly = d.months > 1 ? `($${p.price.toLocaleString()}/mo)` : '';
      return `<button class="duration-opt" data-duration="${d.key}" data-months="${d.months}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;border:2px solid var(--border);border-radius:var(--radius);background:var(--bg-card);cursor:pointer;transition:all 0.2s;text-align:center">
        <span style="font-weight:600;font-size:14px;color:var(--text)">${d.label}</span>
        ${monthly ? `<span style="font-size:11px;color:var(--text-secondary)">${monthly}</span>` : ''}
        <span style="font-weight:700;font-size:18px;color:var(--primary);margin-top:4px">$${total.toLocaleString()}</span>
      </button>`;
    }).join('');
    durationOpts.querySelectorAll('.duration-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        durationOpts.querySelectorAll('.duration-opt').forEach(b => { b.style.borderColor = 'var(--border)'; b.style.background = 'var(--bg-card)'; });
        btn.style.borderColor = 'var(--primary)';
        btn.style.background = 'color-mix(in srgb, var(--primary) 8%, var(--bg-card))';
        const dur = btn.dataset.duration;
        const months = parseInt(btn.dataset.months);
        const total = p.price * months;
        payBtn.innerHTML = `${I('fas fa-credit-card')} Pay $${total.toLocaleString()} (${months > 1 ? months + ' months' : '1 month'})`;
        payBtn.style.display = '';
        payBtn._payType = 'rent';
        payBtn._propId = p.id;
        payBtn._payDuration = dur;
      });
    });
  } else {
    payBtn.style.display = 'none';
  }
  /* Bank info */
  fetch(`${API_URL}/api/payments/settings`).then(r => r.json()).then(d => {
    if (d && d.bank_name) {
      bankDetails.innerHTML = `
        <div><strong>Bank:</strong> ${sanitizeHTML(d.bank_name) || ''}</div>
        <div><strong>Account Name:</strong> ${sanitizeHTML(d.account_name) || ''}</div>
        <div><strong>Account Number:</strong> ${sanitizeHTML(d.account_number) || ''}</div>
        ${d.routing ? `<div><strong>Routing:</strong> ${sanitizeHTML(d.routing)}</div>` : ''}
        ${d.iban ? `<div><strong>IBAN:</strong> ${sanitizeHTML(d.iban)}</div>` : ''}
        ${d.swift ? `<div><strong>SWIFT:</strong> ${sanitizeHTML(d.swift)}</div>` : ''}`;
      bankInfoDiv.style.display = '';
    } else {
      bankInfoDiv.style.display = 'none';
    }
  }).catch(() => { bankInfoDiv.style.display = 'none'; });
}

function closeModal() { modalOverlay.classList.remove('active'); document.body.style.overflow = ''; if (window._modalMap) { window._modalMap.remove(); window._modalMap = null; } }
$('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('modalInquire').addEventListener('click', () => {
  const t = $('modalTitle').textContent, l = $('modalLocation').querySelector('span').textContent, pr = $('modalPrice').textContent;
  closeModal();
  $('inquiryProperty').value = `${t} - ${l} (${pr})`;
  $('inquiryType').value = pr.includes('/mo') ? 'rent' : 'buy';
  document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => contactForm.querySelector('input[name="name"]').focus(), 600);
});

$('modalPay').addEventListener('click', async () => {
  const btn = $('modalPay');
  if (!btn._propId || !btn._payType) return;
  if (btn._payType === 'rent' && !btn._payDuration) { showToast('Please select a rental duration first'); return; }
  const cfgRes = await fetch(`${API_URL}/api/stripe/config`);
  const cfg = await cfgRes.json();
  if (!cfg.configured) { showToast('Payment not configured yet'); return; }
  btn.disabled = true; btn.textContent = 'Redirecting...';
  try {
    const payload = { property_id: btn._propId, type: btn._payType };
    if (btn._payDuration) payload.duration = btn._payDuration;
    const res = await fetch(`${API_URL}/api/payments/create-checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Payment failed');
    window.location.href = data.url;
  } catch (err) { showToast(err.message); btn.disabled = false; btn.textContent = btn._payType === 'deposit' ? `Pay $${DEPOSIT_AMOUNT.toLocaleString()} Deposit` : 'Select Duration'; }
});

$('mobileToggle').addEventListener('click', () => nav.classList.toggle('active'));
nav.querySelectorAll('a').forEach(l => l.addEventListener('click', () => nav.classList.remove('active')));
document.addEventListener('click', e => { if (!e.target.closest('.header-inner')) nav.classList.remove('active'); });

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = contactForm.querySelector('.btn-submit');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  const fd = new FormData(contactForm);
  const payload = { name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), inquiry_type: fd.get('inquiry_type'), property: fd.get('property'), message: fd.get('message') };
  try {
    const res = await fetch(`${API_URL}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    contactForm.reset();
    btn.textContent = 'Send Message';
    btn.disabled = false;
    showToast('Message sent! I\'ll get back to you soon.');
  } catch (err) {
    btn.textContent = 'Send Message';
    btn.disabled = false;
    showToast(err.message || 'Could not send. Try again.');
  }
});
if (window.location.search.includes('payment=success')) { showToast('Payment successful! Thank you.'); window.history.replaceState({}, '', window.location.pathname); }
if (window.location.search.includes('payment=canceled')) { showToast('Payment canceled.'); window.history.replaceState({}, '', window.location.pathname); }

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('visible');
  clearTimeout(t._timeout); t._timeout = setTimeout(() => t.classList.remove('visible'), 2500);
}

/* Dark Mode */
const savedTheme = localStorage.getItem('theme');
function setThemeIcon(name) { const el = $('themeToggle'); const use = el.querySelector('use'); if (use) use.setAttribute('href', '#' + name); else { const i = el.querySelector('i'); if (i) i.className = 'fas ' + name; } }
if (savedTheme === 'dark') { document.body.setAttribute('data-theme', 'dark'); setThemeIcon('sun'); }
$('themeToggle').addEventListener('click', () => {
  const d = document.body.hasAttribute('data-theme');
  if (d) { document.body.removeAttribute('data-theme'); localStorage.setItem('theme', 'light'); setThemeIcon('moon'); }
  else { document.body.setAttribute('data-theme', 'dark'); localStorage.setItem('theme', 'dark'); setThemeIcon('sun'); }
});

/* Scroll to Top */
window.addEventListener('scroll', () => { window.scrollY > 400 ? scrollTop.classList.add('visible') : scrollTop.classList.remove('visible'); }, { passive: true });
scrollTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* Testimonials */
function renderTestimonials() {
  fetch('/api/testimonials').then(r => r.json()).then(testimonials => {
    const g = $('testimonialsGrid');
    if (!testimonials.length) {
      g.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px">No testimonials yet.</p>';
      return;
    }
    g.innerHTML = testimonials.map((t, i) => `
      <div class="testimonial-card" style="--i:${i}">
        <div class="testimonial-stars">${I('fas fa-star').repeat(Math.min(5, Math.max(1, t.rating || 5)))}</div>
        <p class="testimonial-text">"${sanitizeHTML(t.content)}"</p>
        <div class="testimonial-author">
          <div class="testimonial-avatar">${t.image ? `<img src="${t.image}" alt="${sanitizeHTML(t.name)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">` : (t.name ? t.name.charAt(0).toUpperCase() : '?')}</div>
          <div><div class="testimonial-name">${sanitizeHTML(t.name)}</div><div class="testimonial-role">${sanitizeHTML(t.role) || ''}</div></div>
        </div>
      </div>
    `).join('');
  }).catch(() => {});
}

/* FAQ Chatbot */
const faqData = [
  { q: "How do I buy a property?", a: "First, get pre-approved for a mortgage. Then contact me to view properties that match your budget. I'll guide you through the entire process — from offer to closing." },
  { q: "What documents do I need?", a: "You'll need a valid ID, proof of income (pay stubs, tax returns), bank statements, and a pre-approval letter from a lender." },
  { q: "How much down payment is required?", a: "It varies: conventional loans typically require 5-20% down, FHA loans as low as 3.5%, and VA loans may require 0%." },
  { q: "What are the closing costs?", a: "Closing costs are typically 2-5% of the purchase price and include appraisal, inspection, title insurance, and lender fees." },
  { q: "How long does the buying process take?", a: "From offer to closing usually takes 30-45 days, depending on financing and inspections." },
  { q: "Can I rent with bad credit?", a: "Yes, some landlords accept tenants with less-than-perfect credit, especially with a larger security deposit or co-signer." },
  { q: "What properties are available?", a: "I have a wide range of properties — houses, apartments, condos, and villas. Use the search filters above to find exactly what you need!" },
  { q: "Do you help with selling too?", a: "Absolutely! I provide market analysis, professional photography, listing management, and negotiation services to get you the best price." },
  { q: "What areas do you serve?", a: "I cover all major areas. Check the listings to see available properties in your preferred location." }
];

function toggleChat() {
  $('chatBody').classList.toggle('open');
  const msgs = $('chatMsgs');
  if ($('chatBody').classList.contains('open') && msgs.children.length <= 1) {
    addBotMsg("Hi! I'm Primenest Reality's virtual assistant. Ask me anything about buying, renting, or selling properties!");
    showFaqOptions();
  }
}

function addBotMsg(text) {
  const d = document.createElement('div'); d.className = 'chat-msg bot'; d.textContent = text;
  $('chatMsgs').appendChild(d);
  $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
}

function addUserMsg(text) {
  const d = document.createElement('div'); d.className = 'chat-msg user'; d.textContent = text;
  $('chatMsgs').appendChild(d);
  $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
}

function showFaqOptions() {
  const c = document.createElement('div'); c.className = 'chat-options';
  faqData.forEach((item, i) => {
    const b = document.createElement('button'); b.className = 'chat-option'; b.textContent = item.q;
    b.onclick = () => { addUserMsg(item.q); c.remove(); addBotMsg(item.a); showToast('FAQ answered'); setTimeout(showFaqOptions, 800); };
    c.appendChild(b);
  });
  $('chatMsgs').appendChild(c);
  $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
}

$('chatToggle').addEventListener('click', toggleChat);
$('chatClose').addEventListener('click', () => $('chatBody').classList.remove('open'));

/* Property Match Quiz */
function startQuiz() {
  $('quizIntro').style.display = 'none';
  $('quizQuestions').style.display = 'block';
  showQuestion(0);
}
const quizQuestions = [
  { q: "What type of property are you looking for?", options: ["House", "Apartment", "Condo", "Villa"] },
  { q: "What's your budget range?", options: ["Under $200k", "$200k - $500k", "$500k - $1M", "$1M+"] },
  { q: "How many bedrooms do you need?", options: ["1", "2", "3", "4+"] },
  { q: "What's your preferred location?", options: ["City Center", "Suburban", "Beachfront", "Mountain/Quiet"] }
];
let quizAnswers = [];
let quizStep = 0;

function showQuestion(idx) {
  quizStep = idx;
  const q = quizQuestions[idx];
  let html = `<p class="quiz-question">${sanitizeHTML(q.q)}</p><div class="quiz-options">`;
  q.options.forEach((opt, i) => {
    html += `<button class="quiz-opt" onclick="answerQuiz(${i})">${sanitizeHTML(opt)}</button>`;
  });
  html += '</div>';
  $('quizQuestions').innerHTML = html;
}

function answerQuiz(idx) {
  quizAnswers.push({ question: quizQuestions[quizStep].q, answer: quizQuestions[quizStep].options[idx] });
  if (quizStep < quizQuestions.length - 1) {
    showQuestion(quizStep + 1);
  } else {
    showQuizResult();
  }
}

function showQuizResult() {
  const typeMap = { "House": "house", "Apartment": "apartment", "Condo": "condo", "Villa": "villa" };
  const priceMap = { "Under $200k": "0-200000", "$200k - $500k": "200000-500000", "$500k - $1M": "500000-1000000", "$1M+": "1000000-999999999" };
  const type = typeMap[quizAnswers[0]?.answer] || '';
  const price = priceMap[quizAnswers[1]?.answer] || '';
  const bedsNeeded = parseInt(quizAnswers[2]?.answer) || 0;
  const matched = properties.filter(p => (p.status !== 'deposited' && p.status !== 'rented') && (!type || p.type === type) && (!price || matchesPrice(p.price, price)) && p.beds >= bedsNeeded);
  let html = '<p class="quiz-result-title">Based on your answers:</p>';
  if (matched.length === 0) html += '<p class="quiz-result-text">No exact matches found. Let me help you find something close — contact me directly!</p>';
  else html += `<p class="quiz-result-text">Found ${matched.length} matching propert${matched.length > 1 ? 'ies' : 'y'}!</p><div class="quiz-matches">`;
  matched.slice(0, 3).forEach(p => {
    html += `<div class="quiz-match" onclick="openModal(properties.find(x => x.id === ${p.id}))">
      <img src="${p.image}" alt="${sanitizeHTML(p.title)}"><div><strong>${sanitizeHTML(p.title)}</strong><br>${formatPrice(p.price, p.badge)} | ${p.beds} bed | ${sanitizeHTML(p.location)}</div>
    </div>`;
  });
  html += '</div><button class="btn-search" onclick="resetQuiz()">Try Again</button>';
  $('quizQuestions').innerHTML = html;
}

function resetQuiz() {
  quizAnswers = []; quizStep = 0;
  $('quizIntro').style.display = 'block';
  $('quizIntro').innerHTML = `<h3>Find Your Perfect Property</h3><p>Answer 4 quick questions and I'll match you with the best properties.</p><button class="btn-search" onclick="startQuiz()">Start Quiz</button>`;
  $('quizQuestions').style.display = 'none';
}

/* Map */
function createMapIcon(p) {
  const color = p.badge === 'sale' ? '#1a73e8' : '#059669';
  const label = formatPrice(p.price, p.badge);
  return L.divIcon({
    className: 'map-marker',
    html: `<div class="map-marker-inner" style="background:${color}"><span>${label}</span></div>`,
    iconSize: [0, 0],
    popupAnchor: [0, -10]
  });
}

function createPopupContent(p) {
  const popup = document.createElement('div');
  popup.className = 'map-popup';
  popup.innerHTML = `
    <div class="map-popup-img"><img src="${p.image}" alt="${sanitizeHTML(p.title)}" loading="lazy"></div>
    <div class="map-popup-body">
      <div class="map-popup-price">${formatPrice(p.price, p.badge)}</div>
      <div class="map-popup-title">${sanitizeHTML(p.title)}</div>
          <div class="map-popup-location">${I('fas fa-map-marker-alt')} ${sanitizeHTML(p.location)}</div>
      <div class="map-popup-features">
        <span>${I('fas fa-bed')} ${p.beds}</span>
        <span>${I('fas fa-bath')} ${p.baths}</span>
        <span>${I('fas fa-ruler-combined')} ${p.sqft.toLocaleString()} sqft</span>
      </div>
      <button class="map-popup-btn" data-id="${p.id}">View Details</button>
    </div>`;
  popup.querySelector('.map-popup-btn').addEventListener('click', () => openModal(p));
  return popup;
}

function initMap() {
  const el = document.getElementById('propertyMap');
  if (typeof L === 'undefined' || !el) return;

  const isDark = document.body.hasAttribute('data-theme');
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

  let map;
  if (window._propMap) {
    map = window._propMap;
    map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
  } else {
    map = L.map(el, { zoomControl: false }).setView([39.8283, -98.5795], 4);
    L.tileLayer(tileUrl, { attribution: attr, maxZoom: 20 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    window._propMap = map;
  }

  const markers = [];
  const bounds = [];

  properties.forEach(p => {
    if (p.status === 'deposited' || p.status === 'rented') return;
    const marker = L.marker([p.lat, p.lng], { icon: createMapIcon(p) }).addTo(map);
    const popupEl = createPopupContent(p);
    marker.bindPopup(popupEl, { maxWidth: 320, className: 'map-popup-wrapper', closeButton: true });
    markers.push(marker);
    bounds.push([p.lat, p.lng]);

    marker.on('mouseover', () => marker.setZIndexOffset(1000));
    marker.on('mouseout', () => marker.setZIndexOffset(0));
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
  }

  /* Sync with property cards */
  document.querySelectorAll('.property-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const id = Number(card.dataset.id);
      const m = markers.find((_, i) => properties[i].id === id);
      if (m) {
        map.flyTo(m.getLatLng(), 10, { duration: 0.6 });
        m.setZIndexOffset(1000);
        setTimeout(() => { if (m._icon) m._icon.style.transform += ' scale(1.3)'; }, 100);
      }
    });
    card.addEventListener('mouseleave', () => {
      markers.forEach(m => m.setZIndexOffset(0));
      markers.forEach(m => { if (m._icon) m._icon.style.transform = m._icon.style.transform.replace(' scale(1.3)', ''); });
      if (bounds.length) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12, duration: 0.6 });
    });
  });

  /* Re-theme on dark mode toggle */
  const observer = new MutationObserver(() => {
    const dark = document.body.hasAttribute('data-theme');
    const newUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
        L.tileLayer(newUrl, { attribution: attr, maxZoom: 20 }).addTo(map);
      }
    });
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}

/* Map — lazy-loaded when user scrolls to #map or calls initMap */
function loadLeafletScript() {
  return new Promise((resolve, reject) => {
    if (typeof L !== 'undefined') { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function tryInitMap() {
  var el = document.getElementById('propertyMap');
  if (!el) return;
  var observer = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      loadLeafletScript().then(function() { initMap(); }).catch(function(){});
    }
  }, { rootMargin: '200px' });
  observer.observe(el);
}

/* Gallery Carousel */
function initCarousel(modalImageEl, images) {
  if (!images || images.length === 0) return;
  modalImageEl.innerHTML = `
    <div class="carousel" style="position:relative;width:100%;height:100%;display:flex;flex-direction:column">
      <div class="carousel-main" style="position:relative;flex:1;min-height:0;touch-action:pan-y">
        <img src="${images[0]}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
        ${images.length > 1 ? `
          <button class="carousel-btn carousel-prev" onclick="carouselMove(-1)" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;z-index:5;font-size:18px;display:flex;align-items:center;justify-content:center">${I('fas fa-chevron-left')}</button>
          <button class="carousel-btn carousel-next" onclick="carouselMove(1)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;z-index:5;font-size:18px;display:flex;align-items:center;justify-content:center">${I('fas fa-chevron-right')}</button>
          <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;padding:4px 14px;border-radius:12px;font-size:13px;z-index:5" id="carouselCounter">1 / ${images.length}</div>
        ` : ''}
      </div>
      ${images.length > 1 ? `
        <div class="carousel-thumbs" style="display:flex;gap:6px;padding:8px;overflow-x:auto;background:#111;flex-shrink:0;-webkit-overflow-scrolling:touch">
          ${images.map((src, i) => `<img src="${src}" onclick="carouselGo(${i})" style="width:80px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;opacity:${i === 0 ? 1 : 0.5};border:${i === 0 ? '2px solid var(--primary)' : '2px solid transparent'};flex-shrink:0;transition:opacity 0.2s,border 0.2s" data-index="${i}">`).join('')}
        </div>
      ` : ''}
    </div>`;
  window._carouselImages = images;
  window._carouselThumbs = modalImageEl.querySelectorAll('.carousel-thumbs img');
  window._carouselImg = modalImageEl.querySelector('.carousel-main img');
  const mainEl = modalImageEl.querySelector('.carousel-main');
  if (mainEl && images.length > 1) {
    let sx = 0, sy = 0;
    mainEl.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    mainEl.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) { dx < 0 ? carouselMove(1) : carouselMove(-1); }
    }, { passive: true });
  }
}

function carouselMove(dir) {
  const images = window._carouselImages;
  const img = window._carouselImg;
  if (!images || !img) return;
  let current = images.indexOf(img.src);
  if (current === -1) current = 0;
  current = (current + dir + images.length) % images.length;
  goToImage(current);
}

function carouselGo(index) {
  goToImage(index);
}

function goToImage(index) {
  const images = window._carouselImages;
  const img = window._carouselImg;
  const thumbs = window._carouselThumbs;
  if (!images || !img || index < 0 || index >= images.length) return;
  img.src = images[index];
  const counter = document.getElementById('carouselCounter');
  if (counter) counter.textContent = `${index + 1} / ${images.length}`;
  if (thumbs) {
    thumbs.forEach((t, i) => {
      t.style.opacity = i === index ? '1' : '0.5';
      t.style.border = i === index ? '2px solid var(--primary)' : '2px solid transparent';
    });
    thumbs[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

/* Override openModal for gallery */
const _origOpenModal = openModal;
openModal = function(p) {
  _origOpenModal(p);
  let gallery = p.gallery || [];
  if (typeof gallery === 'string') { try { gallery = JSON.parse(gallery); } catch(e) { gallery = []; } }
  if (!Array.isArray(gallery)) gallery = [];
  const images = [p.image, ...gallery].filter(Boolean);
  initCarousel($('modalImage'), images);
};

/* Blog */
async function loadBlogPosts() {
  try {
    const res = await fetch(`${API_URL}/api/blog`);
    if (!res.ok) return hideBlogSkeletons();
    const posts = await res.json();
    const grid = document.getElementById('blogGrid');
    if (!posts.length) { grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px">No posts yet. Check back soon!</p>'; return; }
    grid.innerHTML = posts.slice(0, 3).map(p => `
      <a href="/blog/${p.slug || p.id}" class="blog-card" style="text-decoration:none;color:inherit;display:block">
        ${p.image ? `<div class="blog-image"><img src="${p.image}" alt="${sanitizeHTML(p.title)}" loading="lazy"></div>` : ''}
        <div class="blog-body">
          <div class="blog-date">${sanitizeHTML(p.created_at?.split(' ')[0]) || ''}</div>
          <h3 class="blog-title">${sanitizeHTML(p.title)}</h3>
          <p class="blog-excerpt">${sanitizeHTML(p.excerpt) || ''}</p>
          <span class="blog-read-more">Read More ${I('fas fa-arrow-right')}</span>
        </div>
      </a>
    `).join('');
    hideBlogSkeletons();
  } catch { hideBlogSkeletons(); }
}
function hideBlogSkeletons() { document.querySelectorAll('#blogGrid .skeleton-card').forEach(e => e.remove()); }


renderTestimonials();
resetQuiz();
updateListings();
loadPropertiesFromApi();
tryInitMap();
loadBlogPosts();
loadContactInfo();

/* Open property modal if loaded from /property/:id page */
if (window.__propertyId) {
  const p = properties.find(x => x.id === window.__propertyId);
  if (p) openModal(p);
}

/* Handle rental renewal links from email */
(function handleRenewal() {
  const params = new URLSearchParams(window.location.search);
  const renew = params.get('renew');
  const propId = parseInt(params.get('property_id'));
  if (!renew || !propId) return;
  window.history.replaceState({}, '', window.location.pathname);

  if (renew === 'yes') {
    const p = properties.find(x => x.id === propId);
    if (p) {
      openModal(p);
      showToast('Select a rental duration and complete payment to re-rent.');
    }
  } else if (renew === 'no') {
    showToast('Thank you! This property will be available for rent after the current lease expires.');
  }
})();

/* ═══════════════════════════════════════════════
   ANIMATIONS — delete this block to remove
   ═══════════════════════════════════════════════ */

function initAnimations() {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.querySelectorAll('.stat-number').forEach(el => animateCounter(el));
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .stagger').forEach(el => revealObserver.observe(el));
}

function animateCounter(el) {
  const raw = el.textContent.replace(/[+,%]/g, '').trim();
  const target = parseInt(raw);
  if (!target || target < 1 || el.dataset.animated) return;
  el.dataset.animated = 'true';
  const suffix = el.textContent.includes('+') ? '+' : el.textContent.includes('%') ? '%' : '';
  const duration = 1200;
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = (progress >= 1 ? target : current).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Header shadow on scroll */
document.addEventListener('scroll', () => {
  const h = document.querySelector('.header');
  if (!h) return;
  h.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

initAnimations();
