import { auth, db } from "./firebase.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Dashboard: User authenticated", user.uid);
        await loadUserData(user.uid);
        loadCustomOrders(user.uid); // Start real-time order tracking
        await updateWishlistCount();
    } else {
        // Not logged in, redirect to login
        console.log("Dashboard: No user found, redirecting...");
        window.location.href = "login.html";
    }
});

// Load Orders (Both Cart and Custom)
function loadCustomOrders(uid) {
    const ordersList = document.getElementById("order-history");
    const statCards = document.querySelectorAll(".stat-card h3");
    const activeStat = statCards[0];
    const completedStat = statCards[1];

    console.log("Fetching orders for UID:", uid);

    // 🔥 Removed orderBy to avoid index requirement
    const q = query(
        collection(db, "custom_orders"), 
        where("userId", "==", uid)
    );

    onSnapshot(q, (snapshot) => {
        console.log("Orders Snapshot received, size:", snapshot.size);
        
        if (snapshot.empty) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No orders yet. Ready to furnish your home?</p>
                    <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                        <a href="index.html" class="btn-primary" style="padding:10px 20px;">Browse Store</a>
                        <a href="custom-order.html" class="btn-primary" style="padding:10px 20px; background:var(--text-primary);">Custom Request</a>
                    </div>
                </div>
            `;
            if (activeStat) activeStat.innerText = "0";
            if (completedStat) completedStat.innerText = "0";
            return;
        }

        let activeCount = 0;
        let completedCount = 0;
        
        // 🛠️ Client-side sorting by creation date
        const allOrders = [];
        snapshot.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));
        
        allOrders.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA; // Newest first
        });

        let ordersHTML = "";
        allOrders.forEach((order) => {
            const status = order.status || "Pending";
            const progress = order.progress || (order.currentStep ? (order.currentStep * 12.5) : 12);
            const isCartOrder = order.furniture?.type === "Cart Order";
            
            if (status === "Delivered") {
                completedCount++;
            } else {
                activeCount++;
            }

            let detailContent = "";
            if (isCartOrder) {
                const items = order.furniture?.items || [];
                const itemsHtml = items.map(item => `
                    <div class="cart-item-mini">
                        <img src="${item.image}" alt="${item.name}">
                        <div class="mini-info">
                            <p class="name">${item.name}</p>
                            <p class="qty">Qty: ${item.qty} × ₹${item.price.toLocaleString()}</p>
                        </div>
                    </div>
                `).join("");
                
                detailContent = `
                    <div class="cart-items-preview">
                        ${itemsHtml}
                        <div class="order-summary-mini">
                            <p><strong>Total Paid:</strong> ₹${order.summary?.total?.toLocaleString() || 0}</p>
                        </div>
                    </div>
                `;
            } else {
                detailContent = `
                    <div class="order-details-grid">
                        <div>
                            <p><strong>Material:</strong> ${order.preferences?.material || "N/A"}</p>
                            <p><strong>Size:</strong> ${order.furniture?.dimensions?.length || "?"}x${order.furniture?.dimensions?.width || "?"} ${order.furniture?.dimensions?.unit || ""}</p>
                        </div>
                        ${order.imageUrl ? `
                        <div class="upload-link">
                            <a href="${order.imageUrl}" target="_blank">
                                <i class="fa-solid fa-image"></i> View My Design
                            </a>
                        </div>
                        ` : ""}
                    </div>
                `;
            }

            ordersHTML += `
                <div class="order-card card">
                    <div class="order-header">
                        <div class="order-info">
                            <h4>${isCartOrder ? "Store Order" : (order.furniture?.type || "Custom Order")}</h4>
                            <span class="order-id">ID: #${order.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div class="order-status-badge status-${status.toLowerCase().replace(/\s+/g, "-")}">
                            ${status}
                        </div>
                    </div>
                    
                    ${detailContent}

                    <div class="progress-container">
                        <div class="progress-labels">
                            <span>Request</span>
                            <span>Confirmed</span>
                            <span>Designing</span>
                            <span>Material</span>
                            <span>Production</span>
                            <span>QC Check</span>
                            <span>Shipping</span>
                            <span>Delivered</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        ordersList.innerHTML = ordersHTML;
        if (activeStat) activeStat.innerText = activeCount;
        if (completedStat) completedStat.innerText = completedCount;
    }, (error) => {
        console.error("Dashboard: Firestore query error", error);
        ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted);">Failed to load orders. Error: ${error.message}</p>`;
    });
}


// Load User Data
async function loadUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Sidebar info
            document.getElementById("sidebar-name").innerText = `${data.firstName} ${data.lastName}`;
            document.getElementById("sidebar-avatar").innerText = data.firstName.charAt(0);
            
            // Overview tab
            document.getElementById("dash-name").innerText = data.firstName;
            document.getElementById("info-fullname").innerText = `${data.firstName} ${data.lastName}`;
            document.getElementById("info-email").innerText = data.email;
            document.getElementById("info-since").innerText = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "N/A";
            
            // Settings tab
            document.getElementById("settings-firstname").value = data.firstName;
            document.getElementById("settings-lastname").value = data.lastName;

            // Admin Check
            if (data.role === "admin") {
                const adminBtn = document.getElementById("admin-manage-btn");
                if (adminBtn) adminBtn.style.display = "flex";
            }
            
        } else {
            console.error("No such user document!");
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// Sync Wishlist on changes
window.addEventListener("wishlistUpdated", () => {
    if (window.updateWishlistCount) window.updateWishlistCount();
});

// Handle Settings Update
const settingsForm = document.getElementById("settings-form");
if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const firstName = document.getElementById("settings-firstname").value;
        const lastName = document.getElementById("settings-lastname").value;

        try {
            const docRef = doc(db, "users", user.uid);
            await updateDoc(docRef, {
                firstName: firstName,
                lastName: lastName
            });
            
            window.showToast("Profile Updated Successfully! ✨", "success");
            // Refresh sidebar/header
            document.getElementById("sidebar-name").innerText = `${firstName} ${lastName}`;
            document.getElementById("dash-name").innerText = firstName;
        } catch (error) {
            console.error("Update Error:", error);
            window.showToast("Update Failed: " + error.message, "error");
        }
    });
}

// Globally expose logout for the dashboard button
window.logout = async function() {
    try {
        await signOut(auth);
        window.showToast("Logged out successfully!", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);
    } catch (error) {
        console.error("Logout Error", error);
    }
};
