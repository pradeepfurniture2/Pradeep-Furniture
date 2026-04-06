import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    addDoc, 
    deleteDoc, 
    query, 
    orderBy,
    getDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { coupons as localCoupons } from "./database.js";

let allCoupons = [];

// Auth check (Bypassed for demo)
// onAuthStateChanged(auth, async (user) => {
//     if (user) {
        // ... auth logic ...
//     } else {
//         window.location.href = "admin-login.html";
//     }
// });

// Call listening function directly for the demo
listenForCoupons();

function listenForCoupons() {
    const q = query(collection(db, "coupons"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allCoupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCoupons(allCoupons);
    });
}

function renderCoupons(coupons) {
    const listEl = document.getElementById("admin-coupons-list");
    listEl.innerHTML = "";

    coupons.forEach(c => {
        const card = document.createElement("div");
        card.className = "coupon-card";
        
        const isExpired = new Date(c.expiry) < new Date();
        const statusText = isExpired ? "EXPIRED" : "ACTIVE";
        
        card.innerHTML = `
            <div class="coupon-info">
                <h3>${c.code}</h3>
                <p>Min. Order: ₹${(c.min || 0).toLocaleString()}</p>
                <div style="font-size:10px; margin-top:5px; color: ${isExpired ? '#d32f2f' : '#2e7d32'}">
                    ● ${statusText}
                </div>
            </div>
            <div style="display:flex; align-items:center;">
                <div class="coupon-value">
                    <h2>₹${c.value.toLocaleString()}</h2>
                    <div class="expiry">Expires: ${c.expiry}</div>
                </div>
                <button class="delete-btn" onclick="deleteCoupon('${c.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

// Modal handling
const modal = document.getElementById("couponModal");
const form = document.getElementById("couponForm");

document.getElementById("openAddModal").onclick = () => {
    form.reset();
    modal.style.display = "flex";
};

document.getElementById("closeModal").onclick = () => modal.style.display = "none";
document.getElementById("cancelForm").onclick = () => modal.style.display = "none";

// CRUD
form.onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("saveCouponBtn");
    
    const code = document.getElementById("coup-code").value.toUpperCase();
    const value = parseFloat(document.getElementById("coup-value").value);
    const min = parseFloat(document.getElementById("coup-min").value);
    const expiry = document.getElementById("coup-expiry").value;
    
    try {
        saveBtn.innerText = "Activating...";
        saveBtn.disabled = true;

        await addDoc(collection(db, "coupons"), {
            code,
            value,
            min,
            expiry,
            type: "flat",
            createdAt: serverTimestamp()
        });

        window.showToast("Coupon Activated Successfully!", "success");
        modal.style.display = "none";
    } catch (err) {
        window.showToast("Error: " + err.message, "error");
    } finally {
        saveBtn.innerText = "Activate Offer";
        saveBtn.disabled = false;
    }
};

window.deleteCoupon = async (id) => {
    if (confirm("Permanently remove this coupon?")) {
        try {
            await deleteDoc(doc(db, "coupons", id));
            window.showToast("Coupon Removed!", "success");
        } catch (err) {
            window.showToast("Delete failed: " + err.message, "error");
        }
    }
};

// Migration
document.getElementById("migrateBtn").onclick = async () => {
    const btn = document.getElementById("migrateBtn");
    if (!confirm("Import all hardcoded coupons from database.js?")) return;
    
    try {
        btn.innerText = "Importing...";
        btn.disabled = true;
        
        const batch = writeBatch(db);
        localCoupons.forEach(c => {
            const newDoc = doc(collection(db, "coupons"));
            batch.set(newDoc, {
                ...c,
                createdAt: serverTimestamp(),
                expiry: c.expiry || "2026-12-31",
                min: c.min || 0
            });
        });
        
        await batch.commit();
        window.showToast("All Coupons Imported!", "success");
        btn.style.display = "none";
    } catch (err) {
        window.showToast("Error: " + err.message, "error");
    } finally {
        btn.innerText = "Import Local Codes";
        btn.disabled = false;
    }
};

// Search Logic
document.getElementById("couponSearch").oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allCoupons.filter(c => 
        c.code.toLowerCase().includes(term)
    );
    renderCoupons(filtered);
};
