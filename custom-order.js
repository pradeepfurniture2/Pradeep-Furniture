import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

// Track Auth State
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const submitBtn = document.getElementById("submitBtn");
    if (user) {
        console.log("Custom Order: User logged in", user.uid);
        // Pre-fill email if possible
        const emailField = document.getElementById("cust-email");
        if (emailField && !emailField.value) emailField.value = user.email;
    } else {
        console.log("Custom Order: No user logged in");
    }
});

// Handle Form Submission
const submitBtn = document.getElementById("submitBtn");
if (submitBtn) {
    submitBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        // 1. Check Login
        if (!currentUser) {
            window.showToast("Please Login to submit a custom request! ⚠️", "error");
            setTimeout(() => {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            }, 2000);
            return;
        }

        // 2. Collect Data
        const name = document.getElementById("cust-name").value.trim();
        const mobile = document.getElementById("cust-mobile").value.trim();
        const email = document.getElementById("cust-email").value.trim();
        const city = document.getElementById("cust-city").value.trim();
        const address = document.getElementById("cust-address").value.trim();
        const furnitureType = document.getElementById("furnitureSelect").value;
        const customFurniture = document.getElementById("customBox").value.trim();
        
        const length = document.getElementById("dim-length").value;
        const width = document.getElementById("dim-width").value;
        const height = document.getElementById("dim-height").value;
        const unit = document.getElementById("unitSelected").innerText;

        // Material (active button)
        const activeMaterialBtn = document.querySelector("#materialGroup button.active");
        let material = activeMaterialBtn ? activeMaterialBtn.innerText : "";
        if (material === "Other") {
            material = document.getElementById("otherInput").value.trim();
        }

        const color = document.getElementById("cust-color").value.trim();
        const style = document.getElementById("cust-style").value.trim();
        const polish = document.querySelector("#polishToggle .toggle-btn.active").dataset.value;
        const details = document.getElementById("cust-details").value.trim();

        // 3. Simple Validation
        if (!name || !mobile || !furnitureType || furnitureType === "Select Furniture Type") {
            window.showToast("Please fill in basic details and select furniture type!", "error");
            return;
        }

        // 4. Save to Firestore
        try {
            submitBtn.innerText = "Submitting...";
            submitBtn.disabled = true;

            let imageUrl = null;
            const fileInput = document.getElementById("fileInput");
            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                submitBtn.innerText = "Uploading Image...";
                
                const formData = new FormData();
                formData.append("image", file);
                
                const response = await fetch("https://api.imgbb.com/1/upload?key=7061fe514aae9dbb14744bab15aa4092", {
                    method: "POST",
                    body: formData
                });
                
                const result = await response.json();
                if (result.success) {
                    imageUrl = result.data.url;
                } else {
                    console.error("ImgBB Upload Failed:", result);
                    throw new Error("Image upload failed. " + (result.error?.message || ""));
                }
                
                submitBtn.innerText = "Saving Request...";
            }

            const orderData = {
                userId: currentUser.uid,
                customer: {
                    name,
                    mobile,
                    email,
                    city,
                    address
                },
                furniture: {
                    type: furnitureType === "custom" ? customFurniture : furnitureType,
                    dimensions: { length, width, height, unit }
                },
                preferences: {
                    material,
                    color,
                    style,
                    polish: polish === "yes",
                    details
                },
                imageUrl: imageUrl,
                status: "Pending", // Step 1
                currentStep: 1,
                progress: 12, // Initial progress (Step 1 of 8)
                statusHistory: [
                    { 
                        status: "Pending", 
                        note: "Order request received.", 
                        updatedAt: new Date().toISOString() 
                    }
                ],
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, "custom_orders"), orderData);
            const orderId = docRef.id;

            //* ================= SUCCESS CARD ================= */
            const successBox = document.getElementById("order-success-box");
            if (successBox) {
                document.getElementById("display-order-id").innerText = `#${orderId.toUpperCase()}`;
                successBox.style.display = "block";
                
                // Keep the ID for copying
                window.currentOrderId = orderId.toUpperCase();
                
                // Hide Submit Button
                submitBtn.style.display = "none";
                
                // Scroll to success box
                successBox.scrollIntoView({ behavior: 'smooth' });
            }

            window.showToast(`Order Placed Successfully! 🎉 ID: #${orderId.substring(0, 8).toUpperCase()}`, "success");
            
            // Redirect after a longer delay so they can note the ID
            setTimeout(() => {
                // If they haven't manually clicked Home, maybe stay on page for better UX
                console.log("Auto-redirect suppressed for user interaction.");
            }, 10000);

        } catch (error) {
            console.error("Submission Error:", error);
            window.showToast("Error submitting request: " + error.message, "error");
            submitBtn.innerText = "Submit Custom Request →";
            submitBtn.disabled = false;
        }
    });
}

/* COPY FUNCTION */
window.copyOrderId = function() {
    const idText = window.currentOrderId || document.getElementById("display-order-id").innerText.replace('#', '');
    navigator.clipboard.writeText(idText).then(() => {
        window.showToast("Order ID Copied! 📋", "success");
        const copyBtn = document.getElementById("copyBtn");
        if (copyBtn) {
            copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            setTimeout(() => {
                copyBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copy`;
            }, 2000);
        }
    }).catch(err => {
        console.error("Copy failed:", err);
    });
};
