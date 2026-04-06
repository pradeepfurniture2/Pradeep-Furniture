/* ================= THEME MANAGEMENT ================= */
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  const htmlEl = document.documentElement;
  const themeIcon = themeToggle.querySelector('i');

  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  htmlEl.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);

  themeToggle.addEventListener('click', () => {
    if (themeToggle.classList.contains('theme-animating')) return;

    themeToggle.classList.add('theme-animating');

    setTimeout(() => {
      const currentTheme = htmlEl.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      htmlEl.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeUI(newTheme);

      themeToggle.classList.remove('theme-animating');
    }, 250); // Mid-point of CSS transition
  });

  function updateThemeUI(theme) {
    if (theme === 'dark') {
      themeIcon.className = 'fa-solid fa-sun';
      themeToggle.style.color = '#f5d27a'; // Sun color
    } else {
      themeIcon.className = 'fa-solid fa-moon';
      themeToggle.style.color = ''; // Reset to default
    }
  }
}

/* ================= NAVIGATION HIGHLIGHTING ================= */
function highlightActivePage() {
  const currentPath = window.location.pathname;
  const page = currentPath.split("/").pop() || "index.html";
  
  const navLinks = document.querySelectorAll(".nav-links a");
  
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    if (href === page || (page === "index.html" && href === "/")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

/* ================= COUNTS & PULSE ================= */
function updateWishlistPulse() {
  const heartIconWrap = document.querySelector('.fa-heart')?.parentElement;
  if (!heartIconWrap) return;

  const wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  
  if (wishlist.length === 0) {
    heartIconWrap.classList.add('heart-pulse');
  } else {
    heartIconWrap.classList.remove('heart-pulse');
  }

  // Update count badge
  const wishCountEl = document.getElementById("wishlist-count");
  if (wishCountEl) wishCountEl.innerText = wishlist.length;
}

function updateCartCounts() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartTotal = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
  const cartEl = document.getElementById("cart-count");
  if (cartEl) cartEl.innerText = cartTotal;
}

function toggleMenu() {
  document.querySelector(".nav-links").classList.toggle("active");
}

// Pre-init check to apply theme immediately (though head script handles initial load)
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  highlightActivePage();
  updateWishlistPulse();
  updateCartCounts();
});

// Listen for updates from other scripts
window.addEventListener("cartUpdated", updateCartCounts);
window.addEventListener("wishlistUpdated", updateWishlistPulse);
window.addEventListener("storage", () => {
  updateWishlistPulse();
  updateCartCounts();
});
