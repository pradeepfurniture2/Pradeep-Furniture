import { auth, db, products as dbProducts } from "./database.js"; // Import local DB fallback
import { 
  doc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let liveProducts = [...dbProducts]; // Initialize with 20 items from database.js
window.products = liveProducts; // Global access for legacy code

/* ================= RENDER PRODUCTS ================= */
function getRatingStars(rating = 5.0) {
    let html = "";
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.4; // 0.4 upwards is half star
    for(let i=0; i<full; i++) html += '<i class="fa-solid fa-star"></i>';
    if(half && full < 5) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    const empty = 5 - full - (half ? 1 : 0);
    for(let i=0; i<empty; i++) html += '<i class="fa-regular fa-star"></i>';
    return html;
}

window.renderProducts = function () {
  const container = document.querySelector(".products");
  if (!container) return;

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  
  if (liveProducts.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:var(--text-muted);">
      <i class="fa-solid fa-hourglass-start fa-spin" style="font-size:30px; margin-bottom:10px;"></i>
      <p>Loading the latest collection...</p>
    </div>`;
    return;
  }

  container.innerHTML = "";

  liveProducts.forEach((item, i) => {
    let cartItem = cart.find(c => c.name === item.name);
    let qty = cartItem ? cartItem.qty : 0;

    let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
    let isLiked = wishlist.some(w => w.name === item.name);
    let heartIconClass = isLiked ? "fa-solid" : "fa-regular";
    let likedClass = isLiked ? "liked" : "";

    let btnHTML = "";
    if (qty > 0) {
      btnHTML = `
        <div class="qty-control">
          <button class="qty-btn minus" onclick="updateQty('${item.name}', -1, this)">-</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn plus" onclick="updateQty('${item.name}', 1, this)">+</button>
        </div>
      `;
    } else {
      btnHTML = `
        <button class="add" onclick="addToCart('${item.name}', ${item.price}, '${item.image}', this)">
          Add to Cart
        </button>
      `;
    }

    container.innerHTML += `
    <div class="product-card">
      <div class="card-img" onclick="location.href='product-detail.html?id=${item.id}'" style="cursor:pointer;">
        <img src="${item.image}" alt="" class="product-img">
        <div class="wishlist ${likedClass}" onclick="event.stopPropagation(); toggleWishlist(this, '${item.name}', ${item.price}, '${item.image}')">
          <i class="${heartIconClass} fa-heart"></i>
        </div>
      </div>

      <div class="card-content">
        <div class="card-header-info">
          <span class="product-id">ID: #PF-${item.id ? item.id.toString().substring(0,6).toUpperCase() : 'NEW'}</span>
          <div class="rating" onclick="location.href='product-detail.html?id=${item.id}'" style="cursor:pointer;">
            ${getRatingStars(item.rating)}
            <span class="review-text">${item.reviewsCount || 0}</span>
          </div>
        </div>
        
        <h3 onclick="location.href='product-detail.html?id=${item.id}'" style="cursor:pointer;">${item.name}</h3>
        <p class="price">₹${item.price.toLocaleString()}</p>

        <div class="card-buttons">
          ${btnHTML}
          <button class="custom" onclick="goToCustom('${item.name}', ${item.price}, '${item.image}')">
            Customize
          </button>
        </div>
        
        <a href="product-detail.html?id=${item.id}" style="display:block; text-align:center; margin-top:15px; font-size:12px; font-weight:600; color:var(--accent-color); text-decoration:none;">
            <i class="fa-solid fa-comments"></i> Read Genuine Reviews
        </a>
      </div>
    </div>
    `;
  });
};

/* ================= LIVE PRODUCTS LISTENER ================= */
function initLiveProducts() {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      liveProducts = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      window.products = liveProducts;
    } else {
      // Keep local dbProducts if Firestore is empty
      liveProducts = [...dbProducts];
      window.products = liveProducts;
    }
    window.renderProducts();
  });
}

/* ================= CART COUNT ================= */
window.updateCartCount = function () {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let total = cart.reduce((sum, item) => sum + (item.qty || 0), 0);

  let countEl = document.getElementById("cart-count");
  if (countEl) {
    countEl.innerText = total;
  }
};

/* ================= FLY ANIMATION ================= */
window.flyToCart = function (btn) {
  if (!btn) return;
  let productCard = btn.closest(".product-card");
  let img = productCard?.querySelector(".product-img");
  let cartIcon = document.querySelector(".cart-icon i");

  if (img && cartIcon) {
    let imgRect = img.getBoundingClientRect();
    let cartRect = cartIcon.getBoundingClientRect();

    let flyingImg = img.cloneNode(true);
    flyingImg.classList.add("fly-img");
    document.body.appendChild(flyingImg);

    flyingImg.style.position = "fixed";
    flyingImg.style.top = imgRect.top + "px";
    flyingImg.style.left = imgRect.left + "px";

    setTimeout(() => {
      flyingImg.style.top = cartRect.top + "px";
      flyingImg.style.left = cartRect.left + "px";
      flyingImg.style.width = "30px";
      flyingImg.style.height = "30px";
      flyingImg.style.opacity = "0.5";
    }, 10);

    setTimeout(() => {
      flyingImg.remove();
      cartIcon.classList.add("cart-bounce");
      setTimeout(() => {
        cartIcon.classList.remove("cart-bounce");
      }, 400);
    }, 800);
  }
};

/* ================= UPDATE QTY ================= */
window.updateQty = function (name, change, btn) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += change;
    if (existing.qty <= 0) {
      cart = cart.filter(item => item.name !== name);
    } else if (change > 0 && btn) {
      window.flyToCart(btn);
    }
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  window.updateCartCount();
  window.renderProducts();

  window.dispatchEvent(new Event("cartUpdated"));
};

/* ================= ADD TO CART ================= */
window.addToCart = function (name, price, image, btn) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      name: name,
      price: price,
      image: image,
      qty: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  console.log("✅ Cart Updated:", cart);

  window.updateCartCount();

  if (btn) {
    window.flyToCart(btn);
  }

  window.renderProducts();
  window.dispatchEvent(new Event("cartUpdated"));
};

/* ================= WISHLIST TOGGLE ================= */
window.toggleWishlist = async function (el, name, price, image) {
  let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  let index = wishlist.findIndex(item => item.name === name);

  if (index !== -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push({ name, price, image });
  }

  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  
  // SYNC WITH FIRESTORE IF LOGGED IN
  const user = auth.currentUser;
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        wishlist: wishlist
      });
      console.log("Wishlist synced to Firestore");
    } catch (error) {
      console.error("Firestore Wishlist Sync Error:", error);
    }
  }

  if (window.updateWishlistCount) window.updateWishlistCount();
  window.renderProducts();
};

/* ================= SEARCH ================= */
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const value = this.value.toLowerCase();
    const cards = document.querySelectorAll(".product-card");
    cards.forEach(card => {
      const title = card.querySelector("h3").innerText.toLowerCase();
      const id = card.querySelector(".product-id")?.innerText.toLowerCase();
      if (title.includes(value) || (id && id.includes(value))) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  });
}

const section = document.getElementById("tiltSection");
const text = document.querySelector(".tilt-text");

if (section && text) {
  section.addEventListener("mousemove", (e) => {
    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 10; // left-right
    const rotateX = -((y - centerY) / centerY) * 10; // up-down
    text.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  section.addEventListener("mouseleave", () => {
    text.style.transform = "rotateX(0deg) rotateY(0deg)";
  });
}

/* ================= PREMIUM INTERACTIONS ================= */
// Focus-Blur Effect: Blur background when dropdown is open
const dropdowns = document.querySelectorAll('.nav-links li.dropdown, .nav-links li:has(.menu)');
const heroSection = document.getElementById('hero'); // Primary background element
const productSection = document.querySelector('.products');

function setFocusBlur(active) {
    const mainContent = document.querySelectorAll('body > :not(.navbar)');
    mainContent.forEach(el => {
        if (el.tagName !== 'SCRIPT') {
            el.style.transition = 'filter 0.4s ease, opacity 0.4s ease';
            el.style.filter = active ? 'blur(4px) brightness(0.8)' : 'none';
            el.style.opacity = active ? '0.7' : '1';
        }
    });
}

dropdowns.forEach(dd => {
    dd.addEventListener('mouseenter', () => setFocusBlur(true));
    dd.addEventListener('mouseleave', () => setFocusBlur(false));
});

// Magnetic Link Effect
document.querySelectorAll('.nav-links > li > a').forEach(link => {
    link.addEventListener('mousemove', (e) => {
        const rect = link.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        link.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });
    
    link.addEventListener('mouseleave', () => {
        link.style.transform = `translate(0, 0)`;
    });
});

/* ================= MOBILE MENU ================= */
window.toggleMenu = function() {
  const navLinks = document.querySelector(".nav-links");
  const menuToggle = document.querySelector(".menu-toggle");
  
  navLinks.classList.toggle("active");
  
  if (navLinks.classList.contains("active")) {
    menuToggle.style.transform = "rotate(90deg) scale(1.2)";
    setTimeout(() => menuToggle.innerHTML = "✕", 150);
    document.body.style.overflow = "hidden"; // Prevent scroll
  } else {
    menuToggle.style.transform = "rotate(0deg) scale(1)";
    setTimeout(() => menuToggle.innerHTML = "☰", 150);
    document.body.style.overflow = "";
  }
};


// Handle mobile accordion (multi-level dropdown)
document.querySelectorAll(".nav-links li.dropdown > a, .menu li:has(.menu) > a").forEach(link => {
  link.addEventListener("click", function(e) {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      e.stopPropagation();
      
      const parentLi = this.parentElement;
      const subMenu = parentLi.querySelector(".menu");
      
      // Toggle active class on parent LI for chevron rotation
      parentLi.classList.toggle("active");
      
      // Toggle display of the submenu
      if (subMenu) {
        if (subMenu.style.display === "block") {
          subMenu.style.display = "none";
          subMenu.classList.remove("active");
        } else {
          subMenu.style.display = "block";
          subMenu.classList.add("active");
        }
      }
    }
  });
});

// Close mobile menu when clicking outside
document.addEventListener("click", (e) => {
  const navLinks = document.querySelector(".nav-links");
  const menuToggle = document.querySelector(".menu-toggle");
  
  if (navLinks && navLinks.classList.contains("active")) {
    if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
      navLinks.classList.remove("active");
      menuToggle.innerHTML = "☰";
    }
  }
});

// Close menu when clicking on a final link (not a dropdown)
document.querySelectorAll(".nav-links a:not(:has(+ .menu))").forEach(link => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 768 && !link.closest(".dropdown") && !link.closest("li:has(.menu)")) {
        document.querySelector(".nav-links").classList.remove("active");
        document.querySelector(".menu-toggle").innerHTML = "☰";
    }
  });
});


/* ================= AUTOMATIC ACTIVE LINK ================= */
function highlightActiveLink() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll(".nav-links a");
    
    links.forEach(link => {
        const linkPath = link.getAttribute("href");
        if (linkPath === currentPath) {
            link.classList.add("active");
            
            // If it's a nested link, also highlight the parent dropdown
            const parentDropdown = link.closest(".dropdown");
            if (parentDropdown) {
                parentDropdown.querySelector("a").classList.add("active");
            }
        }
    });
}

/* ================= INIT ================= */
window.updateCartCount();
initLiveProducts();
highlightActiveLink();