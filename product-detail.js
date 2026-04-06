import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

let currentUser = null;
let currentRating = 0;

if (!productId) {
    window.location.href = "index.html";
}

// 1. Auth Check & UI Setup
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById("review-form-container").style.display = "block";
        document.getElementById("login-to-review").style.display = "none";
    } else {
        document.getElementById("review-form-container").style.display = "none";
        document.getElementById("login-to-review").style.display = "block";
    }
});

// 2. Fetch Product Data
async function loadProduct() {
    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const p = docSnap.data();
            document.getElementById("display-name").innerText = p.name;
            document.getElementById("display-price").innerText = "₹" + p.price.toLocaleString();
            document.getElementById("display-id").innerText = "ID: #PF-" + productId.substring(0,6).toUpperCase();
            document.getElementById("main-product-img").src = p.image;
            if (p.category) {
                // Could add category display if needed
            }

            // Bind Buttons
            document.getElementById("addToCartBtn").onclick = () => {
                if (window.addToCart) window.addToCart(p.name, p.price, p.image);
            };
            document.getElementById("customizeBtn").onclick = () => {
                window.location.href = `custom-order.html?type=${encodeURIComponent(p.name)}`;
            };

            updateDocTitle(p.name);
        } else {
            window.showToast("Product not found!", "error");
            setTimeout(() => window.location.href = "index.html", 2000);
        }
    } catch (err) {
        console.error(err);
    }
}

function updateDocTitle(name) {
    document.title = `${name} | Pradeep Furniture`;
}

// 3. Fetch Reviews (Real-time)
function listenForReviews() {
    const q = query(
        collection(db, "product_reviews"), 
        where("productId", "==", productId),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        const list = document.getElementById("reviews-list");
        const countText = document.getElementById("reviews-count-text");
        
        if (snapshot.empty) {
            list.innerHTML = `<p style="text-align:center; padding:30px; color:var(--text-muted); background:var(--card-bg); border-radius:15px;">No reviews yet. Be the first to share your experience!</p>`;
            countText.innerText = "0 reviews";
            return;
        }

        countText.innerText = `${snapshot.size} reviews`;
        let html = "";
        
        snapshot.forEach((doc) => {
            const r = doc.data();
            const date = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric'}) : "Just now";
            const initial = r.userName ? r.userName.charAt(0).toUpperCase() : "?";

            html += `
                <div class="review-card">
                    <div class="review-user-info">
                        <div class="user-avatar-circle">${initial}</div>
                        <div>
                            <strong style="display:block;">${r.userName || "Customer"}</strong>
                            <div class="review-rating-stars">${getRatingStars(r.rating)}</div>
                        </div>
                    </div>
                    <p class="review-comment">${r.comment}</p>
                    <span class="review-date">${date}</span>
                </div>
            `;
        });
        list.innerHTML = html;
    });
}

function getRatingStars(rating) {
    let stars = "";
    for(let i=0; i<5; i++) {
        stars += `<i class="${i < rating ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
    }
    return stars;
}

// 4. Star Selector Logic
document.querySelectorAll("#star-selector i").forEach(star => {
    star.addEventListener("click", (e) => {
        currentRating = parseInt(e.target.dataset.val);
        updateStarUI();
    });
});

function updateStarUI() {
    document.querySelectorAll("#star-selector i").forEach(star => {
        const val = parseInt(star.dataset.val);
        if (val <= currentRating) {
            star.classList.add("active");
        } else {
            star.classList.remove("active");
        }
    });
}

// 5. Submit Review
document.getElementById("submitReview").onclick = async () => {
    const comment = document.getElementById("review-text").value.trim();
    const btn = document.getElementById("submitReview");

    if (!currentUser) {
        window.showToast("Please login to post a review", "error");
        return;
    }

    if (currentRating === 0) {
        window.showToast("Please select a rating", "warning");
        return;
    }

    if (!comment) {
        window.showToast("Please write a short comment", "warning");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "Posting...";

        // Get user details
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userDoc.data();
        const fullName = userData ? `${userData.firstName} ${userData.lastName}` : "Authenticated Customer";

        await addDoc(collection(db, "product_reviews"), {
            productId,
            userId: currentUser.uid,
            userName: fullName,
            rating: currentRating,
            comment: comment,
            createdAt: serverTimestamp()
        });

        window.showToast("Thank you for your genuine review! ✅", "success");
        
        // Reset Form
        document.getElementById("review-text").value = "";
        currentRating = 0;
        updateStarUI();

    } catch (err) {
        console.error(err);
        window.showToast("Failed to post review: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Post Review";
    }
};

// Global Add to Cart support (if scripts not loaded)
window.addToCart = async function(name, price, image) {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    let item = cart.find(c => c.name === name);
    if (item) {
        item.qty++;
    } else {
        cart.push({ name, price, image, qty: 1 });
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));
    window.showToast("Added to Cart!", "success");
};

// Start
loadProduct();
listenForReviews();
