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
    featured: true
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
    featured: true
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
    featured: true
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
    featured: false
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
    featured: true
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
    featured: false
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
    featured: true
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
    featured: false
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
    featured: true
  }
];

const listingsGrid = document.getElementById('listingsGrid');
const noResults = document.getElementById('noResults');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const priceFilter = document.getElementById('priceFilter');
const typeFilter = document.getElementById('typeFilter');
const mobileToggle = document.getElementById('mobileToggle');
const nav = document.getElementById('nav');
const contactForm = document.getElementById('contactForm');

function formatPrice(price, badge) {
  if (badge === 'rent') {
    return `$${price.toLocaleString()}/mo`;
  }
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  return `$${price.toLocaleString()}`;
}

function createPropertyCard(property) {
  const card = document.createElement('div');
  card.className = 'property-card';
  card.innerHTML = `
    <div class="property-image">
      <img src="${property.image}" alt="${property.title}" loading="lazy">
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
  return card;
}

function matchesPrice(price, filter) {
  if (!filter) return true;
  const [min, max] = filter.split('-').map(Number);
  return price >= min && price <= max;
}

function renderProperties(list) {
  listingsGrid.innerHTML = '';
  if (list.length === 0) {
    noResults.classList.add('visible');
    return;
  }
  noResults.classList.remove('visible');
  list.forEach(property => {
    listingsGrid.appendChild(createPropertyCard(property));
  });
}

function filterProperties() {
  const query = searchInput.value.toLowerCase().trim();
  const priceVal = priceFilter.value;
  const typeVal = typeFilter.value;

  const filtered = properties.filter(p => {
    const matchSearch = !query ||
      p.title.toLowerCase().includes(query) ||
      p.location.toLowerCase().includes(query) ||
      p.type.toLowerCase().includes(query);
    const matchPrice = matchesPrice(p.price, priceVal);
    const matchType = !typeVal || p.type === typeVal;
    return matchSearch && matchPrice && matchType;
  });

  renderProperties(filtered);
}

searchForm.addEventListener('submit', e => {
  e.preventDefault();
  filterProperties();
});

[searchInput, priceFilter, typeFilter].forEach(el => {
  el.addEventListener('input', filterProperties);
  el.addEventListener('change', filterProperties);
});

listingsGrid.addEventListener('click', e => {
  const favBtn = e.target.closest('.property-fav');
  if (favBtn) {
    const icon = favBtn.querySelector('i');
    icon.classList.toggle('far');
    icon.classList.toggle('fas');
    showToast(icon.classList.contains('fas') ? 'Added to favorites' : 'Removed from favorites');
  }
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

contactForm.addEventListener('submit', e => {
  e.preventDefault();
  contactForm.reset();
  showToast('Message sent! We\'ll get back to you soon.');
});

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

renderProperties(properties);
