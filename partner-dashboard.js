import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

// Initialize Dashboard
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData && userData.role === 'partner') {
            setupDashboard(userData);
            loadLeads();
            loadCatalog();
            loadEarnings();
        } else {
            window.location.href = 'index.html'; // Redirect non-partners
        }
    } else {
        window.location.href = 'login.html';
    }
});

function setupDashboard(userData) {
    document.getElementById('partner-name-header').textContent = userData.firstName || 'Partner';
    document.getElementById('welcome-partner').textContent = `Welcome, ${userData.showroomName || userData.firstName}`;
    
    // Setup Profile Form
    document.getElementById('prof-showroom-name').value = userData.showroomName || 'Pradeep Partner Showroom';
    document.getElementById('prof-partner-name').value = `${userData.firstName} ${userData.lastName}`;
    document.getElementById('prof-email').value = userData.email;
    document.getElementById('prof-phone').value = userData.phone || '';
    document.getElementById('prof-address').value = userData.address || '';
    
    // Explicitly initialize the default tab
    window.switchTab('overview');
}

// 📋 Tab Switching
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(`${tabName}-section`).style.display = 'block';
    document.getElementById(`tab-${tabName}`).classList.add('active');
};

// 📝 Lead Submission
const leadForm = document.getElementById('quick-lead-form');
if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('lead-name').value;
        const phone = document.getElementById('lead-phone').value;
        const product = document.getElementById('lead-product').value;

        try {
            await addDoc(collection(db, "partner_leads"), {
                partnerId: currentUser.uid,
                customerName: name,
                customerPhone: phone,
                productInterest: product,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            window.showToast('Lead submitted successfully! Our team will contact them.', 'success');
            leadForm.reset();
        } catch (error) {
            console.error("Error adding lead: ", error);
            window.showToast('Error submitting lead. Please try again.', 'error');
        }
    });
}

// 📸 Catalog Upload
const catalogForm = document.getElementById('catalog-upload-form');
if (catalogForm) {
    catalogForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('cat-submit-btn');
        const name = document.getElementById('cat-name').value;
        const price = parseFloat(document.getElementById('cat-price').value);
        const desc = document.getElementById('cat-desc').value;
        const fileInput = document.getElementById('cat-image');
        
        if (!fileInput.files.length) return;

        btn.textContent = "Uploading...";
        btn.disabled = true;

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async function() {
            try {
                const base64Image = reader.result;
                await addDoc(collection(db, "partner_catalogs"), {
                    partnerId: currentUser.uid,
                    name: name,
                    price: price,
                    description: desc,
                    image: base64Image,
                    createdAt: serverTimestamp()
                });

                window.showToast('Product added to your catalog!', 'success');
                catalogForm.reset();
                document.getElementById('catalog-upload-form-container').style.display = 'none';
            } catch (error) {
                console.error("Error uploading product: ", error);
                window.showToast("Upload failed: " + error.message, 'error');
            } finally {
                btn.textContent = "Upload to Catalog";
                btn.disabled = false;
            }
        };

        reader.readAsDataURL(file);
    });
}

// 📦 Load Leads
function loadLeads() {
    const q = query(
        collection(db, "partner_leads"), 
        where("partnerId", "==", currentUser.uid)
    );

    onSnapshot(q, (snapshot) => {
        const recentLeadsList = document.getElementById('recent-leads-list');
        const allLeadsList = document.getElementById('all-leads-list');
        const totalLeadsEl = document.getElementById('stat-total-leads');
        
        let allLeads = [];
        snapshot.forEach(d => {
            const data = d.data();
            allLeads.push({ id: d.id, ...data });
        });

        // Sort in-memory to avoid 'Index Required' error
        allLeads.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        let leadsHtml = '';
        let recentLeadsHtml = ''; // New for limiting to 10
        let count = 0;
        let cancelledCount = 0; 

        allLeads.forEach((data, index) => {
            if (data.status === 'cancelled') cancelledCount++;
            
            const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Just now';
            const updatedAt = data.statusUpdatedAt?.toDate ? data.statusUpdatedAt.toDate() : null;
            let statusTimeStr = "";
            let isNewUpdate = false;

            if (updatedAt) {
                const now = new Date();
                const diffMs = now - updatedAt;
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 60) statusTimeStr = `${diffMins}m ago`;
                else if (diffMins < 1440) statusTimeStr = `${Math.floor(diffMins/60)}h ago`;
                else statusTimeStr = updatedAt.toLocaleDateString();
                if (diffMins < 30) isNewUpdate = true;
            }

            const currentStatus = data.status || "pending";
            const statusClass = `status-pill ${currentStatus.toLowerCase()}`;
            const badge = isNewUpdate ? `<span class="new-update-badge">JUST IN</span>` : '';
            
            const rowHtml = `
                <tr>
                    <td><strong>${data.customerName}</strong></td>
                    <td>${data.customerPhone || 'N/A'}</td>
                    <td>${data.productInterest}</td>
                    <td>
                        <span class="${statusClass}">${currentStatus.toUpperCase()}</span>
                        ${badge}
                    </td>
                    <td>
                        <div style="font-size:13px;">${date}</div>
                        <div style="font-size:10px; color:var(--accent-color); font-weight:600;">${statusTimeStr ? `Update: ${statusTimeStr}` : ''}</div>
                    </td>
                </tr>
            `;

            leadsHtml += rowHtml;
            if (index < 10) recentLeadsHtml += rowHtml; // Only first 10 for overview
            count++;
        });

        if (recentLeadsList) recentLeadsList.innerHTML = recentLeadsHtml || '<tr><td colspan="4" style="text-align:center;">No recent leads.</td></tr>';
        if (allLeadsList) allLeadsList.innerHTML = leadsHtml || '<tr><td colspan="5" style="text-align:center;">No leads yet.</td></tr>';
        if (totalLeadsEl) totalLeadsEl.textContent = count;

        const cancelledEl = document.getElementById('stat-cancelled');
        if (cancelledEl) cancelledEl.textContent = cancelledCount;

        // Sidebar Badge Sync
        const sidebarCountEl = document.getElementById('sidebar-leads-count');
        if (sidebarCountEl) {
            sidebarCountEl.textContent = count;
            sidebarCountEl.style.display = count > 0 ? "block" : "none";
        }
    });
}

// 🛋️ Load Catalog (Fetched from partner_catalogs collection)
function loadCatalog() {
    const catalogGrid = document.getElementById('partner-catalog-grid');
    if (!catalogGrid) return;

    const q = query(collection(db, "partner_catalogs"), where("partnerId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        let html = '';
        if (snapshot.empty) {
            catalogGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">You have not uploaded any products to your catalog yet.</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const p = doc.data();
            html += `
                <div class="catalog-card">
                    <img src="${p.image}" class="catalog-img" alt="${p.name}" style="height: 250px; object-fit: cover; width: 100%;">
                    <div class="catalog-info">
                        <span style="font-size:10px; color:var(--accent-color); font-weight:700;">Showroom Item</span>
                        <h3>${p.name}</h3>
                        <div class="catalog-price">₹${p.price.toLocaleString()}</div>
                        <p style="font-size:12px; color:var(--text-muted); margin-top:5px;">${p.description || "No description provided."}</p>
                    </div>
                </div>
            `;
        });
        catalogGrid.innerHTML = html;
    });
}

// 💰 Load Earnings Real-Time
function loadEarnings() {
    const q = query(
        collection(db, "partner_leads"),
        where("partnerId", "==", currentUser.uid),
        where("status", "in", ["converted", "paid"])
    );

    onSnapshot(q, (snapshot) => {
        let total = 0;
        let pending = 0;
        let paid = 0;
        let convertedCount = 0; // Added count for converted leads
        let tableHtml = '';

        snapshot.forEach((doc) => {
            const data = doc.data();
            const commission = data.commissionAmount || 0;
            const status = data.paymentStatus || 'pending';
            
            total += commission;
            if (status === 'pending') pending += commission;
            if (status === 'paid') paid += commission;
            convertedCount++; // Increment count per lead in this snapshot

            tableHtml += `
                <tr>
                    <td>#LD-${doc.id.substring(0,6).toUpperCase()}</td>
                    <td>${data.customerName}</td>
                    <td>${data.commissionRate || '5%'}</td>
                    <td>₹${commission.toLocaleString()}</td>
                    <td><span class="status-pill ${status}">${status.toUpperCase()}</span></td>
                </tr>
            `;
        });

        const convertedEl = document.getElementById('stat-converted');
        if (convertedEl) convertedEl.textContent = convertedCount;

        document.getElementById('stat-earnings').textContent = `₹${total.toLocaleString()}`;
        document.getElementById('earnings-pending').textContent = `₹${pending.toLocaleString()}`;
        document.getElementById('earnings-paid').textContent = `₹${paid.toLocaleString()}`;
        
        const earningsTable = document.getElementById('earnings-table');
        if (earningsTable) {
            earningsTable.innerHTML = tableHtml || `<tr><td colspan="5" style="text-align:center;">No commissionable conversions yet.</td></tr>`;
        }
    });
}

// Logout
window.logout = function() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
};
