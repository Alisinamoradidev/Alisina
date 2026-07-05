const properties = [
  {
    id: 1,
    title: "Modern Downtown Apartment",
    location: "123 Main St, New York, NY",
    price: 450000,
    type: "apartment",
    beds: 2,
    baths: 2,
    sqft: 1200,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
    badge: "sale",
    featured: true,
    year: 2021
  },
  {
    id: 2,
    title: "Luxury Villa with Pool",
    location: "456 Ocean Dr, Miami, FL",
    price: 1200000,
    type: "villa",
    beds: 5,
    baths: 4,
    sqft: 4200,
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&q=80",
    badge: "sale",
    featured: true,
    year: 2023
  },
  {
    id: 3,
    title: "Cozy Suburban House",
    location: "789 Oak Ln, Austin, TX",
    price: 320000,
    type: "house",
    beds: 3,
    baths: 2,
    sqft: 1800,
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80",
    badge: "sale",
    featured: true,
    year: 2019
  },
  {
    id: 4,
    title: "Downtown Studio Apartment",
    location: "321 Pine St, Seattle, WA",
    price: 1800,
    type: "apartment",
    beds: 1,
    baths: 1,
    sqft: 600,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
    badge: "rent",
    featured: false,
    year: 2020
  },
  {
    id: 5,
    title: "Beachfront Condo",
    location: "555 Shore Dr, Los Angeles, CA",
    price: 680000,
    type: "condo",
    beds: 3,
    baths: 2,
    sqft: 1500,
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80",
    badge: "sale",
    featured: true,
    year: 2022
  },
  {
    id: 6,
    title: "Mountain View House",
    location: "777 Summit Rd, Denver, CO",
    price: 2500,
    type: "house",
    beds: 4,
    baths: 3,
    sqft: 2400,
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80",
    badge: "rent",
    featured: false,
    year: 2018
  },
  {
    id: 7,
    title: "Penthouse Suite",
    location: "999 Skyline Blvd, Chicago, IL",
    price: 2100000,
    type: "condo",
    beds: 4,
    baths: 3,
    sqft: 3200,
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80",
    badge: "sale",
    featured: true,
    year: 2024
  },
  {
    id: 8,
    title: "Garden Apartment",
    location: "222 Green St, Portland, OR",
    price: 1400,
    type: "apartment",
    beds: 2,
    baths: 1,
    sqft: 850,
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80",
    badge: "rent",
    featured: false,
    year: 2017
  },
  {
    id: 9,
    title: "Colonial Family Home",
    location: "444 Maple Ave, Boston, MA",
    price: 575000,
    type: "house",
    beds: 4,
    baths: 3,
    sqft: 2600,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80",
    badge: "sale",
    featured: true,
    year: 2016
  }
];

const listingsGrid = document.getElementById('listingsGrid');
const noResults = document.getElementById('noResults');
const resultsCount = document.getElementById('resultsCount');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const priceFilter = document.getElementById('priceFilter');
const typeFilter = document.getElementById('typeFilter');
const sortSelect = document.getElementById('sortSelect');
const mobileToggle = document.getElementById('mobileToggle');
const themeToggle = document.getElementById('themeToggle');
const nav = document.getElementById('nav');
const contactForm = document.getElementById('contactForm');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const scrollTop = document.getElementById('scrollTop');

let favorites = new Set(JSON.parse(localStorage.getItem('favs') || '[]'));

function formatPrice(price, badge) {
  if (badge === 'rent') {
    return `$${price.toLocaleString()}/mo`;
  }
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  return `$${price.toLocaleString()}`;
}

function getDescription(type) {
  const desc = {
    house: "This stunning home features an open floor plan with abundant natural light, modern finishes throughout, and a spacious backyard perfect for entertaining. The kitchen boasts quartz countertops and stainless steel appliances.",
    apartment: "This stylish apartment offers contemporary living in the heart of the city. Features include hardwood floors, in-unit laundry, and a private balcony with skyline views.",
    condo: "This beautifully maintained condo offers resort-style living with top-of-the-line amenities. Enjoy the community pool, gym, and 24-hour concierge service.",
    villa: "Experience luxury living in this exquisite villa featuring Mediterranean architecture, private pool, landscaped gardens, and premium finishes throughout."
  };
  return desc[type] || "This beautiful property offers modern finishes and an open floor plan with premium amenities.";
}

function setFavIcon(btn, id) {
  const icon = btn.querySelector('i');
  if (favorites.has(id)) {
    icon.className = 'fas fa-heart';
  } else {
    icon.className = 'far fa-heart';
  }
}

function createPropertyCard(property) {
  const card = document.createElement('div');
  card.className = 'property-card';
  card.dataset.id = property.id;
  card.innerHTML = `
    <div class="property-image">
      <img src="${property.image}" alt="${property.title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22><rect fill=%22%23d1d5db%22 width=%22600%22 height=%22400%22/><text fill=%22%236b7280%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>No Image</text></svg>'">
      <span class="property-badge ${property.badge === 'sale' ? 'badge-sale' : 'badge-rent'}">
        ${property.badge === 'sale' ? 'For Sale' : 'For Rent'}
      </span>
      <button class="property-fav" data-id="${property.id}">
        <i class="far fa-heart"></i>
      </button>
    </div>
    <div class="property-body">
      <div class="property-price">${formatPrice(property.price, property.badge)}</div>
      <div class="property-title">${property.title}</div>
      <div class="property-location">
        <i class="fas fa-map-marker-alt"></i>
        ${property.location}
      </div>
      <div class="property-details">
        <span><i class="fas fa-bed"></i> ${property.beds} Beds</span>
        <span><i class="fas fa-bath"></i> ${property.baths} Baths</span>
        <span><i class="fas fa-ruler-combined"></i> ${property.sqft.toLocaleString()} sqft</span>
      </div>
    </div>
  `;
  const favBtn = card.querySelector('.property-fav');
  setFavIcon(favBtn, property.id);
  return card;
}

function matchesPrice(price, filter) {
  if (!filter) return true;
  const [min, max] = filter.split('-').map(Number);
  return price >= min && price <= max;
}

function sortProperties(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
  }
  return sorted;
}

function renderProperties(list) {
  listingsGrid.innerHTML = '';
  if (list.length === 0) {
    noResults.classList.add('visible');
    resultsCount.textContent = 'No properties found';
    return;
  }
  noResults.classList.remove('visible');
  resultsCount.textContent = `Showing ${list.length} of ${properties.length} properties`;
  list.forEach(property => {
    listingsGrid.appendChild(createPropertyCard(property));
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('.property-card').forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), i * 80);
    });
  });
}

function getFilteredAndSorted() {
  const query = searchInput.value.toLowerCase().trim();
  const priceVal = priceFilter.value;
  const typeVal = typeFilter.value;
  const sortVal = sortSelect.value;

  let filtered = properties.filter(p => {
    const matchSearch = !query ||
      p.title.toLowerCase().includes(query) ||
      p.location.toLowerCase().includes(query) ||
      p.type.toLowerCase().includes(query);
    const matchPrice = matchesPrice(p.price, priceVal);
    const matchType = !typeVal || p.type === typeVal;
    return matchSearch && matchPrice && matchType;
  });

  return sortProperties(filtered, sortVal);
}

function updateListings() {
  renderProperties(getFilteredAndSorted());
}

searchForm.addEventListener('submit', e => {
  e.preventDefault();
  updateListings();
});

[searchInput, priceFilter, typeFilter, sortSelect].forEach(el => {
  el.addEventListener('input', updateListings);
  el.addEventListener('change', updateListings);
});

listingsGrid.addEventListener('click', e => {
  const favBtn = e.target.closest('.property-fav');
  if (favBtn) {
    e.stopPropagation();
    const id = Number(favBtn.dataset.id);
    if (favorites.has(id)) {
      favorites.delete(id);
      showToast('Removed from favorites');
    } else {
      favorites.add(id);
      showToast('Added to favorites');
    }
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    setFavIcon(favBtn, id);
    return;
  }

  const card = e.target.closest('.property-card');
  if (card) {
    const id = Number(card.dataset.id);
    const property = properties.find(p => p.id === id);
    if (property) openModal(property);
  }
});

function openModal(property) {
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalPrice = document.getElementById('modalPrice');
  const modalLocation = document.getElementById('modalLocation');
  const modalDetails = document.getElementById('modalDetails');
  const modalDescription = document.getElementById('modalDescription');
  const modalFav = document.getElementById('modalFav');

  modalImage.innerHTML = `<img src="${property.image.replace('w=600', 'w=800')}" alt="${property.title}">`;
  modalTitle.textContent = property.title;
  modalPrice.textContent = formatPrice(property.price, property.badge);
  modalLocation.querySelector('span').textContent = property.location;
  modalDetails.innerHTML = `
    <span><i class="fas fa-bed"></i> ${property.beds} Beds</span>
    <span><i class="fas fa-bath"></i> ${property.baths} Baths</span>
    <span><i class="fas fa-ruler-combined"></i> ${property.sqft.toLocaleString()} sqft</span>
    <span><i class="fas fa-calendar"></i> Built ${property.year}</span>
  `;
  modalDescription.textContent = getDescription(property.type);

  const icon = modalFav.querySelector('i');
  if (favorites.has(property.id)) {
    icon.className = 'fas fa-heart';
    modalFav.classList.add('saved');
  } else {
    icon.className = 'far fa-heart';
    modalFav.classList.remove('saved');
  }

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  modalFav.onclick = () => {
    if (favorites.has(property.id)) {
      favorites.delete(property.id);
      icon.className = 'far fa-heart';
      modalFav.classList.remove('saved');
      showToast('Removed from favorites');
    } else {
      favorites.add(property.id);
      icon.className = 'fas fa-heart';
      modalFav.classList.add('saved');
      showToast('Added to favorites');
    }
    localStorage.setItem('favs', JSON.stringify([...favorites]));
    const cardFav = document.querySelector(`.property-fav[data-id="${property.id}"]`);
    if (cardFav) setFavIcon(cardFav, property.id);
  };
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('modalInquire').addEventListener('click', () => {
  closeModal();
  showToast('Inquiry sent! We\'ll contact you shortly.');
});

mobileToggle.addEventListener('click', () => {
  nav.classList.toggle('active');
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => nav.classList.remove('active'));
});

document.addEventListener('click', e => {
  if (!e.target.closest('.header-inner')) {
    nav.classList.remove('active');
  }
});

contactForm.addEventListener('submit', () => {
  const btn = contactForm.querySelector('.btn-submit');
  btn.textContent = 'Sending...';
  btn.disabled = true;
});

if (window.location.search.includes('sent=true')) {
  showToast('Message sent! I\'ll get back to you soon.');
  window.history.replaceState({}, '', window.location.pathname + '#contact');
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('visible'), 2500);
}

/* Dark Mode */
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.body.setAttribute('data-theme', 'dark');
  themeToggle.querySelector('i').className = 'fas fa-sun';
}

themeToggle.addEventListener('click', () => {
  const isDark = document.body.hasAttribute('data-theme');
  if (isDark) {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeToggle.querySelector('i').className = 'fas fa-moon';
  } else {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggle.querySelector('i').className = 'fas fa-sun';
  }
});

/* Scroll to Top */
window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    scrollTop.classList.add('visible');
  } else {
    scrollTop.classList.remove('visible');
  }
});

scrollTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

updateListings();
