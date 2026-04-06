import { db } from "./firebase.js";
import { 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Mapping steps to matching indices (1-indexed based on currentStep in admin-orders.js)
const STEPS_LABELS = [
    "Pending",
    "Confirmed",
    "Designing",
    "Material Selection",
    "In Production",
    "Finishing & QC",
    "Out for Delivery",
    "Delivered"
];

/* TRACK FUNCTION */
window.trackOrder = async function() {
    const mobile = document.getElementById("mobile").value.trim();
    const orderIdInput = document.getElementById("orderId").value.trim().toUpperCase();
    const captchaText = document.getElementById("captchaText").innerText.replace(/\s/g, "");
    const captchaInput = document.getElementById("captchaInput").value.trim().toUpperCase();

    const statusBox = document.getElementById("statusBox");
    const previewBox = document.getElementById("previewBox");
    const orderImg = document.getElementById("orderImg");
    const trackBtn = document.querySelector(".track-btn");

    // 1. Basic Validation
    if (!mobile || !orderIdInput) {
        window.showToast("⚠️ Please enter both mobile number and order ID", "error");
        return;
    }

    if (captchaInput !== captchaText) {
        window.showToast("❌ Incorrect Captcha Code", "error");
        window.refreshCaptcha();
        return;
    }

    // Clean the input mobile number (keep only last 10 digits for comparison)
    const cleanMobile = mobile.replace(/\D/g, "").slice(-10);

    console.log("DEBUG: Searching for", { cleanMobile, orderIdInput });

    try {
        trackBtn.innerText = "Searching... 🔍";
        trackBtn.disabled = true;

        // We fetch all orders and filter in JS to be flexible with phone formatting
        const q = query(collection(db, "custom_orders"));
        const querySnapshot = await getDocs(q);

        let foundOrder = null;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dbMobile = (data.customer?.mobile || "").replace(/\D/g, "").slice(-10);
            const dbId = doc.id.toUpperCase();

            // Match both clean mobile and partial ID
            if (dbMobile === cleanMobile && dbId.includes(orderIdInput)) {
                console.log("DEBUG: Match Found!", doc.id);
                foundOrder = { id: doc.id, ...data };
            }
        });

        if (!foundOrder) {
            window.showToast("❌ No matching order found. Check details!", "error");
            statusBox.style.display = "none";
            previewBox.style.display = "none";
            return;
        }

        // 3. Show Results
        window.showToast("Order Found! Showing status... ✨", "success");
        statusBox.style.display = "flex";
        previewBox.style.display = "block";
        
        // Update Order ID display in header if exists
        const idHeader = document.getElementById("orderId-display");
        if (idHeader) idHeader.innerText = `#${foundOrder.id.substring(0,8).toUpperCase()}`;

        // 🖼️ Set Image (Prioritize product/custom image over logo)
        let displayImg = "images/logo.png"; // Default
        
        if (foundOrder.imageUrl) {
            // 1. Custom Order Design Image
            displayImg = foundOrder.imageUrl;
        } else if (foundOrder.furniture?.items && foundOrder.furniture.items.length > 0) {
            // 2. First item from Cart Order
            displayImg = foundOrder.furniture.items[0].image;
        }
        
        orderImg.src = displayImg;
        orderImg.style.display = "block";

        // Update Steps with Dates
        const currentStep = foundOrder.currentStep || 1;
        const steps = document.querySelectorAll(".step");
        const history = foundOrder.statusHistory || [];

        steps.forEach((stepEl, i) => {
            const stepLabel = STEPS_LABELS[i];
            
            // Find if this status exists in history
            const historyEntry = history.find(h => h.status === stepLabel);
            let dateStr = "";

            if (historyEntry && historyEntry.updatedAt) {
                const d = new Date(historyEntry.updatedAt);
                dateStr = d.toLocaleString('en-IN', { 
                    day: '2-digit', month: 'short', 
                    hour: '2-digit', minute: '2-digit', hour12: true 
                });
            } else if (i === 0 && foundOrder.createdAt) {
                const d = foundOrder.createdAt.toDate ? foundOrder.createdAt.toDate() : new Date(foundOrder.createdAt);
                dateStr = d.toLocaleString('en-IN', { 
                    day: '2-digit', month: 'short', 
                    hour: '2-digit', minute: '2-digit', hour12: true 
                });
            }

            // Update HTML with date and note if active
            const title = stepEl.innerText.split("\n")[0];
            if (i < currentStep) {
                stepEl.classList.add("active");
                let noteHtml = (historyEntry && historyEntry.note) ? 
                    `<p class="step-note"><i class="fa-solid fa-comment-dots"></i> ${historyEntry.note}</p>` : "";
                
                stepEl.innerHTML = `
                    <div class="step-header">
                        <span>${title}</span>
                        <span class="step-time">${dateStr}</span>
                    </div>
                    ${noteHtml}
                `;
            } else {
                stepEl.classList.remove("active");
                stepEl.innerHTML = `<span>${title}</span>`;
            }
        });

    } catch (error) {
        console.error("Tracking Error:", error);
        window.showToast("Error searching for order. Please try again.", "error");
    } finally {
        trackBtn.innerText = "Track Order →";
        trackBtn.disabled = false;
        refreshCaptcha();
    }
};

/* CAPTCHA REFRESH */
function refreshCaptcha() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let cap = "";
    for (let i = 0; i < 5; i++) {
        cap += chars[Math.floor(Math.random() * chars.length)] + " ";
    }
    const el = document.getElementById("captchaText");
    if (el) el.innerText = cap.trim();
}
window.refreshCaptcha = refreshCaptcha;

// Initialize Captcha
document.addEventListener("DOMContentLoaded", () => {
    if (typeof refreshCaptcha === "function") refreshCaptcha();
});
