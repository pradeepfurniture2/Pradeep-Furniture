const products = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
    title: "Air Max Plus",
    description: "Comfortable & Stylish shoes for daily use.",
    price: 120.0,
    badge: "New Arrival",
    badgeColor: "bg-red-500",
    category: "Running"
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a",
    title: "Nike Air Force 1",
    description: "Classic look with legendary cushioning.",
    price: 100.0,
    badge: "Classic",
    badgeColor: "bg-blue-500",
    category: "Lifestyle"
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77",
    title: "Adidas Superstar",
    description: "Timeless shell-toe design for the streets.",
    price: 85.0,
    badge: "Trending",
    badgeColor: "bg-yellow-500",
    category: "Fashion"
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772",
    title: "New Balance 574",
    description: "Premium materials meet effortless style.",
    price: 90.0,
    badge: "Heritage",
    badgeColor: "bg-green-500",
    category: "Heritage"
  },
  {
    id: 5,
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa",
    title: "Nike Dunk Low",
    description: "Skate-inspired comfort for every surface.",
    price: 110.0,
    badge: "Skate",
    badgeColor: "bg-indigo-500",
    category: "Skate"
  },
  {
    id: 6,
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5",
    title: "Adidas Ultraboost",
    description: "Energy return like you've never felt before.",
    price: 180.0,
    badge: "Performance",
    badgeColor: "bg-purple-500",
    category: "Performance"
  },
  {
    id: 7,
    image: "https://images.unsplash.com/photo-1539185441755-769473a23570",
    title: "Converse Chuck 70",
    description: "The foundation for all sneaker enthusiasts.",
    price: 75.0,
    badge: "Iconic",
    badgeColor: "bg-pink-500",
    category: "Iconic"
  },
  {
    id: 8,
    image: "https://images.unsplash.com/photo-1512374382149-4332c6c02153",
    title: "Puma Suede",
    description: "Revolutionary style that changed the game.",
    price: 65.0,
    badge: "Sale",
    badgeColor: "bg-gray-700",
    category: "Sport"
  }
];

let cartCount = 0;

function renderProducts() {
  const productGrid = document.querySelector(".product-grid");
  if (!productGrid) return;
  
  productGrid.innerHTML = "";
  
  products.forEach(product => {
    const card = document.createElement("div");
    card.classList.add("product-card");
    
    card.innerHTML = `
      <div class="card-image">
        <img src="${product.image}" alt="${product.title}">
        <span class="card-badge ${product.badgeColor}">${product.badge}</span>
      </div>
      <div class="card-content">
        <p class="card-category">${product.category}</p>
        <h3 class="card-title">${product.title}</h3>
        <p class="card-description">${product.description}</p>
        <div class="card-footer">
          <span class="price">$${product.price.toFixed(2)}</span>
          <button class="add-btn" onclick="addToCart()">+</button>
        </div>
      </div>
    `;
    
    productGrid.appendChild(card);
  });
}

function addToCart() {
  cartCount++;
  const badge = document.querySelector(".cart-badge");
  if (badge) {
    badge.innerText = cartCount;
    // Add a small animation
    badge.style.transform = "scale(1.2)";
    setTimeout(() => {
      badge.style.transform = "scale(1)";
    }, 200);
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const themeBtn = document.getElementById("theme-toggle");
  const isDark = document.body.classList.contains("dark");
  
  if (isDark) {
    themeBtn.innerHTML = "☀️";
    localStorage.setItem("theme", "dark");
  } else {
    themeBtn.innerHTML = "🌙";
    localStorage.setItem("theme", "light");
  }
}

// Initial theme check
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    document.getElementById("theme-toggle").innerHTML = "☀️";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  initTheme();
  
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
});
