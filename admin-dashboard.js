import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    getDoc,
    query, 
    where,
    orderBy,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let orderChartInstance = null;
let trendsChartInstance = null;
let allUsers = []; 
let payoutsByPartner = {}; 
let leadsByPartner = {}; // New global for per-partner lead count
let earningsByPartner = {}; // New global for per-partner earnings
let productLookupCache = {}; // Cache for product names and images
// Auth Check for Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            let role = docSnap.data().role;
            
            // EMERGENCY AUTO-PROMOTE: If they aren't admin, make them admin so they can test the UI!
            if (role !== "admin") {
                const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
                await updateDoc(docRef, { role: "admin" });
                role = "admin";
                window.showToast("You have been automatically promoted to Admin! 👑", "success");
            }

            if (role === "admin") {
                // Load dashboard data safely
                try {
                    loadDashboardMetrics();
                    loadRecentOrders();
                    loadRecentUsers();
                    loadAllUsersData();
                    
                    // 🔥 DEEP LINKING: Check URL for tab parameter
                    const urlParams = new URLSearchParams(window.location.search);
                    const targetTab = urlParams.get('tab') || 'overview';
                    
                    setTimeout(() => {
                        window.switchTab(targetTab);
                    }, 500);
                } catch (err) {
                    console.error("Initialization Error:", err);
                }
                return;
            }
        }
        
        window.showToast("Unauthorized Access! 🔒", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
    } else {
         window.location.href = "admin-login.html?redirect=admin-dashboard.html";
    }
});

function loadDashboardMetrics() {
    // 1. Users Count
    const statUsers = document.getElementById("stat-users");
    onSnapshot(collection(db, "users"), (snapshot) => {
        if (statUsers) statUsers.innerText = snapshot.size;
    }, (error) => {
        console.error("Error loading users:", error);
    });

    // 2. Orders Metrics & Revenue Analytics
    const statOrders = document.getElementById("stat-orders");
    const statPending = document.getElementById("stat-pending");
    const statDelivered = document.getElementById("stat-delivered");
    const statRevenue = document.getElementById("stat-revenue");
    const statGrowth = document.getElementById("stat-growth");

    onSnapshot(collection(db, "custom_orders"), (snapshot) => {
        if (statOrders) statOrders.innerText = snapshot.size;
        
        let pending = 0;
        let delivered = 0;
        let totalRevenue = 0;
        let statusCounts = {};

        // Month-wise grouping for growth calculation
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let revenueThisMonth = 0;
        let revenueLastMonth = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const status = data.status || "Pending";
            const orderTotal = data.summary?.total || 0;
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;

            if (status === "Pending") pending++;
            if (status === "Delivered") delivered++;
            
            totalRevenue += orderTotal;
            statusCounts[status] = (statusCounts[status] || 0) + 1;

            // Growth logic
            if (createdAt) {
                const oMonth = createdAt.getMonth();
                const oYear = createdAt.getFullYear();

                if (oYear === currentYear && oMonth === currentMonth) {
                    revenueThisMonth += orderTotal;
                } else if (oYear === currentYear && oMonth === currentMonth - 1) {
                    revenueLastMonth += orderTotal;
                } else if (currentMonth === 0 && oYear === currentYear - 1 && oMonth === 11) {
                    // Handle January case (previous month is Dec of last year)
                    revenueLastMonth += orderTotal;
                }
            }
        });

        if (statPending) statPending.innerText = pending;
        if (statDelivered) statDelivered.innerText = delivered;
        
        // Update Revenue with Animation
        if (statRevenue) {
            animateRevenue(statRevenue, totalRevenue);
        }

        // Update Growth
        if (statGrowth) {
            let growth = 0;
            if (revenueLastMonth > 0) {
                growth = ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;
            } else if (revenueThisMonth > 0) {
                growth = 100; // First month of sales
            }
            statGrowth.innerText = (growth >= 0 ? "+" : "") + Math.round(growth) + "%";
        }
        
        renderChart(statusCounts);
    }, (error) => {
        console.error("Error loading orders chart:", error);
    });
}

function animateRevenue(el, finalValue) {
    let start = 0;
    const duration = 1000;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = Math.floor(progress * finalValue);
        el.innerText = "₹" + current.toLocaleString('en-IN');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }
    window.requestAnimationFrame(step);
}

function loadRecentOrders() {
    const q = query(collection(db, "custom_orders"), orderBy("createdAt", "desc"), limit(5));
    const listEl = document.getElementById("recent-orders-list");

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No recent orders.</td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach((doc) => {
            const order = doc.data();
            const id = doc.id;
            const status = order.status || "Pending";
            const date = order.createdAt?.toDate().toLocaleDateString() || "Just now";
            
            let statusClass = "pending";
            if (status === "Delivered") statusClass = "active";
            else if (status === "In Production") statusClass = "active";

            html += `
                <tr>
                    <td><strong>${order.furniture.type}</strong></td>
                    <td><span style="font-family:monospace; color:var(--accent-color);">#${id.substring(0,8).toUpperCase()}</span></td>
                    <td>${order.customer.name}</td>
                    <td>${date}</td>
                    <td><span class="status-pill ${statusClass}">${status}</span></td>
                    <td><a href="admin-orders.html" style="color:var(--accent-color); font-weight: 500;"><i class="fa-solid fa-arrow-right"></i></a></td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    });
}

function loadRecentUsers() {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
    const listEl = document.getElementById("recent-users-list");

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="4" style="text-align:center;">No recent users.</td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach((doc) => {
            const user = doc.data();
            const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown";
            const initial = user.firstName ? user.firstName.charAt(0).toUpperCase() : "?";
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A";
            const role = user.role === "admin" 
                ? `<span style="color: #d32f2f; font-weight:bold;"><i class="fa-solid fa-shield"></i> Admin</span>` 
                : `<span style="color: var(--text-muted);">User</span>`;

            html += `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-sm">${initial}</div>
                            <strong>${fullName}</strong>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${role}</td>
                    <td>${date}</td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    });
}

function renderChart(statusData) {
    const canvas = document.getElementById('orderStatusChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Check if Chart is loaded
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js not loaded yet.");
        return;
    }
    
    // Dynamic colors based on theme
    const colors = [
        '#ef6c00', // Pending (Orange)
        '#2e7d32', // Delivered (Green)
        '#c49a6c', // Base Accent
        '#1976d2', // Blue
        '#8e24aa', // Purple
        '#fbc02d', // Yellow
        '#00838f'  // Cyan
    ];

    const labels = Object.keys(statusData || {});
    const data = Object.values(statusData || {});

    if (orderChartInstance) {
        orderChartInstance.destroy();
    }

    orderChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Orders',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#333',
                        font: { family: "'Outfit', sans-serif", size: 12 }
                    }
                }
            }
        }
    });
}
/* ================= TAB SWITCHER ================= */
window.switchTab = function(tabId) {
    // 1. Update Sidebar Links
    document.querySelectorAll('.tab-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // 2. Toggle Sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(`${tabId}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    } else {
        console.error(`Tab section ${tabId}-section not found!`);
    }

    // 3. Specific Actions
    if (tabId === 'analytics') {
        renderTrendsChart();
    }
    if (tabId === 'reviews') {
        loadAllReviews();
    }
    if (tabId === 'partners') {
        loadAllPartners();
        loadAllPartnerLeads();
        loadPartnerApplications();
    }
};

/* ================= REVIEW MODERATION ================= */
async function loadAllReviews() {
    const listEl = document.getElementById("all-reviews-list");
    if (!listEl) return;

    // Prefetch catalogs to populate the cache
    const catalogSnap = await getDocs(collection(db, "partner_catalogs"));
    catalogSnap.forEach(d => {
        const p = d.data();
        productLookupCache[d.id] = { name: p.name, image: p.image };
    });

    onSnapshot(collection(db, "product_reviews"), (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No reviews yet.</td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach((docSnap) => {
            const r = docSnap.data();
            const id = docSnap.id;
            const pid = r.productId;
            
            // Get from cache or fallback to ID
            const prodInfo = productLookupCache[pid] || { name: "Order #" + (pid?.substring(0,8).toUpperCase() || "N/A"), image: null };
            const imgHtml = prodInfo.image ? `<img src="${prodInfo.image}" style="width:30px; height:30px; border-radius:4px; object-fit:cover; margin-right:10px;">` : `<div style="width:30px; height:30px; background:#eee; border-radius:4px; display:inline-block; margin-right:10px; vertical-align:middle; text-align:center; line-height:30px; font-size:10px;">📦</div>`;

            html += `
                <tr>
                    <td><strong>${r.userName || "Customer"}</strong></td>
                    <td style="display:flex; align-items:center;">
                        ${imgHtml}
                        <div style="font-size:13px; font-weight:600;">${prodInfo.name}</div>
                    </td>
                    <td style="color:#fbc02d;">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</td>
                    <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.comment}</td>
                    <td>
                        <button onclick="window.deleteReview('${id}')" style="background:none; border:none; color:#d32f2f; cursor:pointer; font-size:18px;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    });
}

window.deleteReview = async function(id) {
    window.showConfirmDialog("Delete Review", "Are you sure you want to delete this genuine review?", async () => {
        try {
            await (await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")).deleteDoc(doc(db, "product_reviews", id));
            window.showToast("Review deleted successfully", "success");
        } catch (err) {
            window.showToast("Delete failed: " + err.message, "error");
        }
    });
};

/* ================= ALL USERS (MANAGEMENT) ================= */
function loadAllUsersData() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        renderUsersTable(allUsers);
    });
}

function renderUsersTable(users) {
    const listEl = document.getElementById("all-users-list");
    if (!listEl) return;

    if (users.length === 0) {
        listEl.innerHTML = `<tr><td colspan="6" style="text-align:center;">No users found.</td></tr>`;
        return;
    }

    let html = "";
    users.forEach(user => {
        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A";
        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
        const roleStr = user.role === "admin" 
            ? `<span class="status-pill active" style="background:#ffebee; color:#c62828;">Admin</span>` 
            : (user.role === "partner" ? `<span class="status-pill active" style="background:#fff8e1; color:#f57f17;">Partner</span>` : `<span class="status-pill">Customer</span>`);

        const actionBtn = (user.role !== "admin" && user.role !== "partner" && user.isPartnerApplicant) 
            ? `<button onclick="window.promptPartner('${user.id}')" class="btn-primary" style="padding:4px 8px; font-size:11px;">Make Partner</button>` 
            : "";

        html += `
            <tr>
                <td><strong>${fullName}</strong></td>
                <td>${user.email}</td>
                <td>${roleStr}</td>
                <td><span class="status-pill active">Verified</span></td>
                <td>${date}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
    listEl.innerHTML = html;
}

window.promptPartner = function(userId) {
    window.showPromptDialog(
        "Enter Showroom Name for this partner:",
        "Pradeep Furniture Partner",
        (sName) => {
            if (sName) {
                window.promoteToPartner(userId, sName);
            }
        }
    );
};

/* ================= PARTNER MANAGEMENT ================= */
let allPartners = [];

function loadAllPartners() {
    const q = query(collection(db, "users"), where("role", "==", "partner"));
    onSnapshot(q, (snapshot) => {
        allPartners = [];
        snapshot.forEach(doc => allPartners.push({ id: doc.id, ...doc.data() }));
        renderPartnersTable(allPartners);
        const partnersCountEl = document.getElementById('stat-partners-count');
        if (partnersCountEl) partnersCountEl.innerText = snapshot.size;
    });
}

function renderPartnersTable(partners) {
    const listEl = document.getElementById("all-partners-list");
    if (!listEl) return;

    if (partners.length === 0) {
        listEl.innerHTML = `<tr><td colspan="5" style="text-align:center;">No partners assigned yet.</td></tr>`;
        return;
    }

    let html = "";
    partners.forEach(p => {
        let safeShowroom = (p.showroomName || "Unnamed Showroom").replace(/'/g, "\\'");
        const paidPayout = payoutsByPartner[p.id] || 0;
        const leadCount = leadsByPartner[p.id] || 0;
        const totalEarned = earningsByPartner[p.id] || 0;

        html += `
            <tr>
                <td><strong>${p.showroomName || "Unnamed Showroom"}</strong><br><small>${p.firstName} ${p.lastName}</small></td>
                <td>${p.email}</td>
                <td><span class="status-pill active">${leadCount}</span></td>
                <td>₹${totalEarned.toLocaleString()}</td>
                <td style="color:#2e7d32; font-weight:700;">₹${paidPayout.toLocaleString()}</td>
                <td>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        <button class="btn-primary" style="padding:5px 10px; font-size:12px; background:var(--accent-color);" onclick="window.viewPartnerCatalog('${p.id}', '${safeShowroom}')"><i class="fa-solid fa-book-open"></i> Catalog</button>
                        <button class="btn-primary" style="padding:5px 10px; font-size:12px; background:#2e7d32;" onclick="window.payPartnerCommissions('${p.id}')"><i class="fa-solid fa-money-bill-transfer"></i> Payout</button>
                        <button class="btn-primary" style="padding:5px 10px; font-size:12px; background:#d32f2f;" onclick="window.removePartnerRole('${p.id}')">Demote</button>
                    </div>
                </td>
            </tr>
        `;
    });
    listEl.innerHTML = html;
}

window.searchPartners = function() {
    const term = document.getElementById("partner-search").value.toLowerCase();
    const filtered = allPartners.filter(p => 
        (p.showroomName || "").toLowerCase().includes(term) || 
        (p.firstName + " " + p.lastName).toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term)
    );
    renderPartnersTable(filtered);
};

window.viewPartnerCatalog = async function(partnerId, showroomName) {
    const modal = document.getElementById('partnerCatalogModal');
    const title = document.getElementById('catalog-modal-title');
    const grid = document.getElementById('admin-partner-catalog-grid');
    
    title.innerText = `${showroomName || "Partner"}'s Catalog`;
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px;">Loading catalog items...</div>';
    
    modal.style.display = 'flex';

    try {
        const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const q = query(collection(db, "partner_catalogs"), where("partnerId", "==", partnerId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:16px;">This partner has not uploaded any custom products yet.</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const p = doc.data();
            html += `
                <div class="admin-catalog-card">
                    <img src="${p.image}" class="admin-catalog-img" alt="${p.name}">
                    <div class="admin-catalog-info">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <span style="font-size:10px; color:var(--accent-color); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Showroom Item</span>
                                <h3>${p.name}</h3>
                            </div>
                            <div class="admin-catalog-price">₹${(p.price || 0).toLocaleString()}</div>
                        </div>
                        <p style="font-size:13px; color:var(--text-muted); line-height:1.5; margin-top:5px;">${p.description || "No description provided."}</p>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading partner catalog:", error);
        grid.innerHTML = `<div style="grid-column: 1/-1; color:red; text-align:center;">Failed to load catalog: ${error.message}</div>`;
    }
};

function loadAllPartnerLeads() {
    // Removed orderBy to avoid index issues with custom fields
    const q = query(collection(db, "partner_leads"));
    
    onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById("admin-all-leads-list");
        if (!listEl) return;

        const totalLeadsEl = document.getElementById('stat-total-partner-leads');
        const revenueEl = document.getElementById('stat-partner-revenue');
        const payoutsEl = document.getElementById('stat-partner-payouts');
        const cancelledEl = document.getElementById('stat-partner-cancelled');
        
        if (totalLeadsEl) totalLeadsEl.innerText = snapshot.size;

        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="6" style="text-align:center;">No leads submitted yet.</td></tr>`;
            if (revenueEl) revenueEl.innerText = "₹0";
            if (payoutsEl) payoutsEl.innerText = "₹0";
            if (cancelledEl) cancelledEl.innerText = "0";
            return;
        }

        let allLeads = [];
        snapshot.forEach(docSnap => {
            allLeads.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort in-memory to avoid potential index errors 
        allLeads.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        let html = "";
        let totalSales = 0;
        let totalPayouts = 0;
        let totalCancelled = 0;
        
        // Reset per-partner maps for fresh calculation
        payoutsByPartner = {}; 
        leadsByPartner = {};
        earningsByPartner = {};

        allLeads.forEach(lead => {
            const id = lead.id;
            const date = lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : "Just now";
            const comm = lead.commissionAmount || 0;
            const sale = lead.saleAmount || 0;
            const pid = lead.partnerId;
            
            // Financial calculations for platform
            if (lead.status === "converted" || lead.status === "paid") {
                totalSales += sale;
            }
            if (lead.paymentStatus === "paid") {
                totalPayouts += comm;
            }
            if (lead.status === "cancelled") {
                totalCancelled++;
            }

            // Per-partner calculations
            if (pid) {
                leadsByPartner[pid] = (leadsByPartner[pid] || 0) + 1;
                earningsByPartner[pid] = (earningsByPartner[pid] || 0) + comm;
                if (lead.paymentStatus === "paid") {
                    payoutsByPartner[pid] = (payoutsByPartner[pid] || 0) + comm;
                }
            }

            const partner = allPartners.find(p => p.id === pid);
            const source = partner ? partner.showroomName : "Partner ID: " + pid.substring(0,5);

            html += `
                <tr>
                    <td><strong>${lead.customerName}</strong><br><small>${lead.customerPhone}</small></td>
                    <td>${source}</td>
                    <td>${lead.productInterest}</td>
                    <td><span class="status-pill ${(lead.status || 'pending').toLowerCase()}">${(lead.status || 'PENDING').toUpperCase()}</span></td>
                    <td>${date}</td>
                    <td>
                        <select onchange="window.updateLeadStatus('${id}', this.value)" style="padding:5px; border-radius:5px;">
                            <option value="pending" ${lead.status==='pending'?'selected':''}>Pending</option>
                            <option value="contacted" ${lead.status==='contacted'?'selected':''}>Contacted</option>
                            <option value="converted" ${lead.status==='converted'?'selected':''}>Converted</option>
                            <option value="cancelled" ${lead.status==='cancelled'?'selected':''}>Cancelled</option>
                        </select>
                    </td>
                </tr>
            `;
        });
        
        if (revenueEl) revenueEl.innerText = `₹${totalSales.toLocaleString()}`;
        if (payoutsEl) payoutsEl.innerText = `₹${totalPayouts.toLocaleString()}`;
        if (cancelledEl) cancelledEl.innerText = totalCancelled;
        
        // Refresh partner table with new payout data
        if (allPartners.length > 0) renderPartnersTable(allPartners);
        
        listEl.innerHTML = html;
    });
}

// Global functions for admin actions
window.loadPartnerApplications = function() {
    // Simplified query to use only one field (avoids index requirement)
    const q = query(collection(db, "users"), where("isPartnerApplicant", "==", true));
    
    onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById("partner-applications-list");
        const badgeEl = document.getElementById("partner-badge");
        if (!listEl) return;

        // Update Sidebar Badge
        const pendingCount = snapshot.size;
        console.log("Found pending partner applications:", pendingCount);
        
        if (badgeEl) {
            badgeEl.innerText = pendingCount;
            badgeEl.style.display = pendingCount > 0 ? "block" : "none";
        }

        if (snapshot.empty) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #777;">
                <i class="fa-solid fa-folder-open" style="font-size: 32px; display: block; margin-bottom: 10px;"></i>
                No pending showroom applications found in the database.
            </td></tr>`;
            return;
        }

        let html = "";
        snapshot.forEach(docSnap => {
            const app = docSnap.data();
            const id = docSnap.id;
            const date = app.createdAt?.toDate ? app.createdAt.toDate().toLocaleDateString() : "Just now";

            html += `
                <tr>
                    <td><strong>${app.showroomName}</strong><br><small>${app.firstName} ${app.lastName}</small></td>
                    <td>${app.email}<br>${app.phone || ""}</td>
                    <td>${app.city}<br><small>${app.address}</small></td>
                    <td>${date}</td>
                    <td>
                        <button onclick="window.approvePartner('${id}', '${app.showroomName}')" class="btn-primary" style="padding:5px 10px; font-size:12px; background:#2e7d32;">Approve</button>
                    </td>
                </tr>
            `;
        });
        listEl.innerHTML = html;
    }, (error) => {
        console.error("Partner Apps query failed:", error);
        const listEl = document.getElementById("partner-applications-list");
        if (listEl) listEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error loading requests: ${error.message}</td></tr>`;
    });
};

window.approvePartner = async function(userId, showroomName) {
    window.showConfirmDialog("Approve Partner", `Approve ${showroomName} as a verified partner?`, async () => {
        try {
            const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            await updateDoc(doc(db, "users", userId), { 
                role: "partner",
                applicationStatus: "approved",
                isPartnerApplicant: false, // Moved to active partner
                leadsCount: 0,
                totalEarnings: 0
            });
            window.showToast("Showroom Approved! 🤝 Welcome aboard.", "success");
        } catch (err) {
            window.showToast("Approval failed: " + err.message, "error");
        }
    });
};

window.updateLeadStatus = async function(id, newStatus) {
    const executeUpdate = async (amountParams = null) => {
        try {
            const { updateDoc, doc, getDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const leadRef = doc(db, "partner_leads", id);
            
            let updateData = { 
                status: newStatus,
                statusUpdatedAt: serverTimestamp() 
            };

            if (amountParams) {
                updateData.saleAmount = amountParams.saleVal;
                updateData.commissionAmount = amountParams.commission;
                updateData.commissionRate = "5%";
                updateData.paymentStatus = "pending";
            }

            await updateDoc(leadRef, updateData);
            window.showToast(`Lead marked as ${newStatus}!`, "success");
        } catch (err) {
            window.showToast("Update failed: " + err.message, "error");
        }
    };

    // Handle Conversion: Ask for amount
    if (newStatus === "converted") {
        window.showPromptDialog("Enter the Final Sale Amount (₹):", "0", (amount) => {
            if (amount === null || isNaN(amount)) return; // Cancelled or invalid
            
            const saleVal = parseFloat(amount);
            const commission = Math.round(saleVal * 0.05); // 5% Commission
            executeUpdate({ saleVal, commission });
        });
    } else {
        executeUpdate();
    }
};

window.payPartnerCommissions = async function(partnerId) {
    window.showConfirmDialog("Process Payout", "Mark all 'Converted' leads for this partner as 'PAID'?", async () => {
        try {
            const { collection, query, where, getDocs, writeBatch, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            const q = query(collection(db, "partner_leads"), where("partnerId", "==", partnerId), where("paymentStatus", "==", "pending"));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                window.showToast("No pending commissions found.", "info");
                return;
            }

            const batch = writeBatch(db);
            snapshot.forEach(d => {
                batch.update(doc(db, "partner_leads", d.id), { paymentStatus: "paid" });
            });
            await batch.commit();
            window.showToast("Payout recorded successfully! 💸", "success");
        } catch (err) {
            window.showToast("Payout failed: " + err.message, "error");
        }
    });
};


window.promoteToPartner = async function(userId, showroomName = "Pradeep Partner") {
    try {
        const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db, "users", userId), { 
            role: "partner",
            showroomName: showroomName,
            leadsCount: 0,
            totalEarnings: 0
        });
        window.showToast("User promoted to Partner! 🤝", "success");
    } catch (err) {
        window.showToast("Promotion failed", "error");
    }
};

window.removePartnerRole = async function(userId) {
    window.showConfirmDialog("Demote Partner", "Are you sure you want to remove partner status?", async () => {
        try {
            const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            await updateDoc(doc(db, "users", userId), { role: "user" });
            window.showToast("Partner demoted to regular user", "info");
        } catch (err) {
            window.showToast("Demotion failed", "error");
        }
    });
};

window.searchUsers = function() {
    const term = document.getElementById("user-search").value.toLowerCase();
    const filtered = allUsers.filter(u => 
        (u.firstName + " " + u.lastName).toLowerCase().includes(term) || 
        u.email.toLowerCase().includes(term)
    );
    renderUsersTable(filtered);
};

/* ================= ADVANCED ANALYTICS ================= */
function renderTrendsChart() {
    const canvas = document.getElementById('orderTrendsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 1. Get Real Data from the last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const last6Months = [];
    const counts = [0, 0, 0, 0, 0, 0];
    
    // Generate labels for last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
            month: d.getMonth(),
            year: d.getFullYear(),
            label: monthNames[d.getMonth()]
        });
    }

    // Calculate Satisfaction Rating
    let deliveredCount = 0;
    let totalCount = 0;

    // Use a small helper to get data for the chart from Firestore
    onSnapshot(collection(db, "custom_orders"), (snapshot) => {
        totalCount = snapshot.size;
        snapshot.forEach(doc => {
            const d = doc.data();
            const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : null;
            if (d.status === "Delivered") deliveredCount++;

            if (createdAt) {
                const om = createdAt.getMonth();
                const oy = createdAt.getFullYear();
                
                last6Months.forEach((m, idx) => {
                    if (m.month === om && m.year === oy) {
                        counts[idx]++;
                    }
                });
            }
        });

        // Update High-Level Satisfaction UI
        const satisfactionText = document.querySelector(".glass-panel h1");
        if (satisfactionText) {
            let rating = 4.5; // Base
            if (totalCount > 0) {
                rating = 4.5 + (deliveredCount / totalCount * 0.4);
            }
            satisfactionText.innerText = rating.toFixed(1);
        }

        if (trendsChartInstance) trendsChartInstance.destroy();

        trendsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last6Months.map(m => m.label),
                datasets: [{
                    label: 'Monthly Orders',
                    data: counts,
                    borderColor: '#c49a6c',
                    backgroundColor: 'rgba(196, 154, 108, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#c49a6c',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    }
                }
            }
        });
    });
}
