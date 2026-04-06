import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    arrayUnion, 
    query, 
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const STEPS = [
    { label: "Pending", progress: 12 },
    { label: "Confirmed", progress: 25 },
    { label: "Designing", progress: 38 },
    { label: "Material Selection", progress: 50 },
    { label: "In Production", progress: 63 },
    { label: "Finishing & QC", progress: 75 },
    { label: "Out for Delivery", progress: 88 },
    { label: "Delivered", progress: 100 }
];

let allOrders = []; // Local cache for filtering

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            let role = docSnap.data().role;
            if (role === "admin") {
                document.getElementById("admin-name").innerText = "Owner Portal: " + docSnap.data().firstName;
                listenForOrders();
                return;
            }
        }
        window.showToast("Unauthorized Access! 🔒", "error");
        setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
    } else {
         window.location.href = "admin-login.html?redirect=admin-orders.html";
    }
});

function listenForOrders() {
    const q = query(collection(db, "custom_orders"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Update stats
        updateStats(allOrders);
        
        // Initial render
        applyFilters();
    });
}

function updateStats(orders) {
    let pending = 0, production = 0, delivered = 0;
    orders.forEach(order => {
        const status = order.status || "Pending";
        if (status === "Pending") pending++;
        if (status === "In Production") production++;
        if (status === "Delivered") delivered++;
    });

    document.getElementById("count-total").innerText = orders.length;
    document.getElementById("count-pending").innerText = pending;
    document.getElementById("count-production").innerText = production;
    document.getElementById("count-delivered").innerText = delivered;
}

function applyFilters() {
    const searchTerm = document.getElementById("orderSearch").value.toLowerCase();
    const statusFilter = document.getElementById("statusFilter").value;
    const typeFilter = document.getElementById("typeFilter") ? document.getElementById("typeFilter").value : "all";

    const filtered = allOrders.filter(order => {
        const matchesSearch = 
            (order.customer?.name || "").toLowerCase().includes(searchTerm) || 
            (order.customer?.mobile || "").includes(searchTerm) || 
            order.id.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;

        let matchesType = true;
        if (typeFilter !== "all" && order.furniture?.type) {
            const isCart = order.furniture.type === "Cart Order";
            if (typeFilter === "cart" && !isCart) matchesType = false;
            if (typeFilter === "custom" && isCart) matchesType = false;
        }

        return matchesSearch && matchesStatus && matchesType;
    });

    renderOrders(filtered);
}

function renderOrders(orders) {
    const listEl = document.getElementById("all-orders-list");
    
    if (orders.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="text-align:center; padding:40px; color:var(--text-muted);">
            <i class="fa-solid fa-search-minus" style="font-size:30px; margin-bottom:10px;"></i>
            <p>No orders match your search criteria.</p>
        </div>`;
        return;
    }

    let html = "";
    orders.forEach((order) => {
        const id = order.id;
        const status = order.status || "Pending";
        const currentStepIndex = STEPS.findIndex(s => s.label === status);
        
        let stepOptions = "";
        STEPS.forEach((step, index) => {
            const selected = status === step.label ? "selected" : "";
            const disabled = index < currentStepIndex ? "disabled" : "";
            stepOptions += `<option value="${index}" ${selected} ${disabled}>Step ${index + 1}: ${step.label}</option>`;
        });

        html += `
            <div class="order-card card" id="card-${id}">
                <div class="order-header">
                    <div class="order-info">
                        <h4>${order.furniture.type}</h4>
                        <p>Customer: <strong>${order.customer.name}</strong> (${order.customer.mobile})</p>
                        <span>ID: #${id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <div class="order-status-badge status-${status.toLowerCase().replace(/\s+/g, "-")}">
                        ${status}
                    </div>
                </div>

                <div class="admin-controls" style="margin-top:15px; border-top:1px solid var(--border-color); padding-top:15px;">
                    <button class="details-btn" onclick="showOrderDetails('${id}')">
                        <i class="fa-solid fa-circle-info"></i> View Full Details
                    </button>
                    
                    <div style="flex-grow:1; display:flex; align-items:center; gap:10px; justify-content:flex-end;">
                        <select class="admin-select" id="select-${id}" style="max-width:200px;" ${status === "Delivered" ? "disabled" : ""}>
                            ${stepOptions}
                        </select>
                        <button class="update-btn" onclick="updateOrderStatus('${id}')" ${status === "Delivered" ? "disabled style='opacity:0.5;cursor:not-allowed;'" : ""}>
                            ${status === "Delivered" ? "Completed" : "Update"}
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// Filter listeners
document.getElementById("orderSearch").addEventListener("input", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);
if (document.getElementById("typeFilter")) {
    document.getElementById("typeFilter").addEventListener("change", applyFilters);
}

// Custom Prompt Function
function showCustomPrompt(text, defaultValue) {
    return new Promise((resolve) => {
        const modal = document.getElementById("promptModal");
        const promptText = document.getElementById("promptText");
        const promptInput = document.getElementById("promptInput");
        const confirmBtn = document.getElementById("confirmPromptBtn");
        const cancelBtn = document.getElementById("cancelPromptBtn");
        const closeBtn = document.getElementById("closePromptModal");

        promptText.innerText = text;
        promptInput.value = defaultValue;
        modal.style.display = "flex";
        
        // short timeout helps input gain focus when modal fades in
        setTimeout(() => promptInput.focus(), 100);

        const cleanup = () => {
            modal.style.display = "none";
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
        };

        confirmBtn.onclick = () => {
            resolve(promptInput.value);
            cleanup();
        };

        cancelBtn.onclick = () => {
            resolve(null);
            cleanup();
        };

        closeBtn.onclick = () => {
            resolve(null);
            cleanup();
        };
    });
}

function showCustomConfirm(queryText) {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirmModal");
        const confirmText = document.getElementById("confirmText");
        const yesBtn = document.getElementById("yesConfirmBtn");
        const cancelBtn = document.getElementById("cancelConfirmBtn");

        confirmText.innerText = queryText;
        modal.style.display = "flex";

        const cleanup = () => {
            modal.style.display = "none";
            yesBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        yesBtn.onclick = () => {
            resolve(true);
            cleanup();
        };

        cancelBtn.onclick = () => {
            resolve(false);
            cleanup();
        };
    });
}

// Update Status function
window.updateOrderStatus = async function(id) {
    const select = document.getElementById("select-" + id);
    const stepIndex = parseInt(select.value);
    const newStep = STEPS[stepIndex];
    const btn = select.nextElementSibling;
    const originalText = btn.innerText;

// Ask for a custom note
    const customNote = await showCustomPrompt(`Add a note for this step (${newStep.label}):`, `Status updated to ${newStep.label}`);
    if (customNote === null) return; // User cancelled

    // Ask for final confirmation
    const isSure = await showCustomConfirm(`Update order status to '${newStep.label}'?`);
    if (!isSure) return;

    try {
        btn.innerText = "Wait...";
        btn.disabled = true;

        const orderRef = doc(db, "custom_orders", id);
        await updateDoc(orderRef, {
            status: newStep.label,
            currentStep: stepIndex + 1,
            progress: newStep.progress,
            statusHistory: arrayUnion({
                status: newStep.label,
                note: customNote,
                updatedAt: new Date().toISOString()
            })
        });

        window.showToast(`Updated to ${newStep.label}`, "success");
    } catch (error) {
        window.showToast("Error: " + error.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// Modal Logic
const modal = document.getElementById("detailsModal");
const closeModal = document.getElementById("closeModal");

window.showOrderDetails = function(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;

    const body = document.getElementById("modal-body");
    const modalTitle = document.getElementById("modal-title");
    const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-IN') : "N/A";
    const isCartOrder = order.furniture?.type === "Cart Order";

    modalTitle.innerText = isCartOrder ? "Store Order Details" : "Custom Order Details";

    let detailsHtml = "";

    if (isCartOrder) {
        const items = order.furniture.items || [];
        const itemsHtml = items.map(item => `
            <div style="display:flex; gap:15px; align-items:center; border-bottom:1px solid var(--border-color); padding:10px 0;">
                <img src="${item.image}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;">
                <div style="flex:1;">
                    <p style="margin:0; font-weight:600;">${item.name}</p>
                    <p style="margin:0; font-size:12px; color:var(--text-muted);">₹${item.price.toLocaleString()} × ${item.qty}</p>
                </div>
                <div style="font-weight:700;">₹${(item.price * item.qty).toLocaleString()}</div>
            </div>
        `).join("");

        detailsHtml = `
            <div class="details-grid">
                <div class="detail-item">
                    <label>Customer Details</label>
                    <p>${order.customer.name}</p>
                    <p style="font-size:13px; color:var(--text-muted);">${order.customer.mobile}</p>
                    <p style="font-size:13px; color:var(--text-muted);">${order.customer.email || ""}</p>
                </div>
                <div class="detail-item">
                    <label>Shipping Address</label>
                    <p>${order.customer.address}, ${order.customer.city}</p>
                    <p>Pincode: ${order.customer.pincode || "N/A"}</p>
                </div>
                
                <div class="detail-item full-width" style="margin-top:15px;">
                    <label>Purchased Items</label>
                    <div style="background:var(--bg-color); border-radius:12px; padding:15px;">
                        ${itemsHtml}
                        <div style="margin-top:15px; border-top:1px dashed var(--border-color); padding-top:10px;">
                            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;">
                                <span>Subtotal:</span> <span>₹${order.summary?.subtotal?.toLocaleString() || 0}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;">
                                <span>Shipping:</span> <span>₹${order.summary?.shipping?.toLocaleString() || 0}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:2px;">
                                <span>GST (18%):</span> <span>₹${order.summary?.gst?.toLocaleString() || 0}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:2px;">
                                <span>CGST (9%):</span> <span>₹${order.summary?.cgst?.toLocaleString() || 0}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom:5px;">
                                <span>SGST (9%):</span> <span>₹${order.summary?.sgst?.toLocaleString() || 0}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:800; color:var(--accent-color); margin-top:10px;">
                                <span>Total Paid:</span> <span>₹${order.summary?.total?.toLocaleString() || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Custom Request
        detailsHtml = `
            <div class="details-grid">
                <div class="detail-item">
                    <label>Customer Name</label>
                    <p>${order.customer.name}</p>
                </div>
                <div class="detail-item">
                    <label>Mobile Number</label>
                    <p>${order.customer.mobile}</p>
                </div>
                <div class="detail-item">
                    <label>City & Address</label>
                    <p>${order.customer.address || "N/A"}, ${order.customer.city || "N/A"}</p>
                </div>
                <div class="detail-item">
                    <label>Furniture Type</label>
                    <p>${order.furniture.type}</p>
                </div>
                <div class="detail-item">
                    <label>Dimensions (LxWxH)</label>
                    <p>${order.furniture.dimensions.length} x ${order.furniture.dimensions.width} x ${order.furniture.dimensions.height} ${order.furniture.dimensions.unit || "N/A"}</p>
                </div>
                <div class="detail-item">
                    <label>Material Preference</label>
                    <p>${order.preferences.material || "Standard Wood"}</p>
                </div>
                <div class="detail-item">
                    <label>Color & Finish</label>
                    <p>${order.preferences.color || "Default"} (${order.preferences.polish ? "Polished" : "Not Polished"})</p>
                </div>
                <div class="detail-item full-width">
                    <label>Special Instructions</label>
                    <p style="background:var(--bg-color); padding:10px; border-radius:8px;">${order.preferences.details || "No special instructions provided."}</p>
                </div>
                <div class="detail-item full-width">
                    <label>Uploaded Reference Design</label>
                    ${order.imageUrl ? 
                        `<img src="${order.imageUrl}" style="width:100%; border-radius:12px; margin-top:10px; border:1px solid var(--border-color); cursor:pointer;" onclick="window.open(this.src)">` : 
                        `<p style="color:var(--text-muted); font-style:italic;">No image uploaded.</p>`
                    }
                </div>
            </div>
        `;
    }

    // Status History (Shared)
    const history = order.statusHistory || [];
    const historyHtml = history.length > 0 ? history.map(h => `
        <div style="border-left:2px solid var(--accent-light); padding-left:15px; margin-top:15px; position:relative;">
            <div style="position:absolute; left:-7px; top:0; width:12px; height:12px; background:var(--accent-color); border-radius:50%;"></div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <strong>${h.status}</strong>
                <span style="font-size:11px; color:var(--text-muted);">${new Date(h.updatedAt).toLocaleString('en-IN')}</span>
            </div>
            <p style="margin:5px 0 0 0; font-size:13px; color:var(--text-secondary);">${h.note || ""}</p>
        </div>
    `).join("") : `<p style="color:var(--text-muted); font-style:italic;">No updates tracked yet.</p>`;

    body.innerHTML = `
        ${detailsHtml}
        <div class="full-width" style="border-top:1px solid var(--border-color); margin-top:30px; padding-top:20px;">
            <label style="color:var(--text-muted); font-size:11px; text-transform:uppercase; font-weight:700;">Order Timeline & Notes</label>
            <div style="max-height:200px; overflow-y:auto; padding:10px;">
                ${historyHtml}
            </div>
        </div>
        <p style="font-size:12px; color:var(--text-muted); margin-top:20px; text-align:right;">Order ID: #${id.toUpperCase()} | Created: ${dateStr}</p>
    `;

    modal.style.display = "flex";
};

closeModal.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };
