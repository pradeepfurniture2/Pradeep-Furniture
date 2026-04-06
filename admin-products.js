import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    query, 
    orderBy,
    getDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { products as localProducts } from "./database.js";

let allProducts = [];
let isEditing = false;
let editId = null;

// Auth check
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().role === "admin") {
            document.getElementById("admin-name").innerText = "Admin: " + docSnap.data().firstName;
            listenForProducts();
        } else {
            window.showToast("Unauthorized Access!", "error");
            window.location.href = "dashboard.html";
        }
    } else {
        window.location.href = "admin-login.html";
    }
});

// Real-time listener
function listenForProducts() {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(allProducts);
    });
}

function renderProducts(products) {
    const listEl = document.getElementById("admin-products-list");
    listEl.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card-admin";
        card.innerHTML = `
            <img src="${p.image}" class="admin-card-img" alt="${p.name}">
            <div class="admin-card-body">
                <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">${p.category}</span>
                <h4>${p.name}</h4>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <p class="price" style="margin:0;">₹${p.price.toLocaleString()}</p>
                    ${p.isPartnerOnly ? '<span style="background:var(--accent-light); color:var(--accent-color); padding:4px 8px; border-radius:6px; font-size:10px; font-weight:700; border:1px solid var(--accent-light);"><i class="fa-solid fa-handshake"></i> PARTNER</span>' : ''}
                </div>
                <p style="font-size:12px; opacity:0.6;">System ID: #PR-${p.id.substring(0,6).toUpperCase()}</p>
            </div>
            <div class="admin-card-footer">
                <button class="action-btn edit-btn" onclick="openEditModal('${p.id}')">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

// Modal handling
const modal = document.getElementById("productModal");
const form = document.getElementById("productForm");
const fileInput = document.getElementById("fileInput");
const imageContainer = document.getElementById("imageContainer");
const imagePreview = document.getElementById("imagePreview");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const uploadOverlay = document.getElementById("uploadOverlay");

document.getElementById("openAddModal").onclick = () => {
    isEditing = false;
    form.reset();
    resetImagePreview();
    document.getElementById("modalTitle").innerText = "Add New Product";
    modal.style.display = "flex";
};

document.getElementById("closeModal").onclick = () => modal.style.display = "none";
document.getElementById("cancelForm").onclick = () => modal.style.display = "none";

// Image handling
imageContainer.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (prev) => {
            imagePreview.src = prev.target.result;
            imagePreview.style.display = "block";
            uploadPlaceholder.style.display = "none";
            uploadOverlay.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
};

function resetImagePreview() {
    imagePreview.src = "";
    imagePreview.style.display = "none";
    uploadPlaceholder.style.display = "block";
    uploadOverlay.style.display = "none";
    fileInput.value = "";
}

// CRUD Operations
form.onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("saveProductBtn");
    const originalText = saveBtn.innerText;
    
    const name = document.getElementById("prod-name").value;
    const price = parseFloat(document.getElementById("prod-price").value);
    const category = document.getElementById("prod-category").value;
    const rating = parseFloat(document.getElementById("prod-rating").value) || 5.0;
    const reviewsCount = parseInt(document.getElementById("prod-reviews").value) || 0;
    const isPartnerOnly = document.getElementById("prod-partner-only").checked;
    
    try {
        saveBtn.innerText = "Processing...";
        saveBtn.disabled = true;

        let finalImageUrl = imagePreview.src;

        // If it's a new file (data URL), upload to ImgBB
        if (finalImageUrl.startsWith("data:image")) {
            saveBtn.innerText = "Uploading Image...";
            const formData = new FormData();
            formData.append("image", fileInput.files[0]);
            
            const res = await fetch("https://api.imgbb.com/1/upload?key=7061fe514aae9dbb14744bab15aa4092", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                finalImageUrl = data.data.url;
            } else {
                throw new Error("Image upload failed");
            }
        }

        const productData = {
            name,
            price,
            category,
            image: finalImageUrl,
            rating,
            reviewsCount,
            isPartnerOnly,
            updatedAt: serverTimestamp()
        };

        if (isEditing) {
            await updateDoc(doc(db, "products", editId), productData);
            window.showToast("Product Updated Successfully!", "success");
        } else {
            productData.createdAt = serverTimestamp();
            await addDoc(collection(db, "products"), productData);
            window.showToast("Product Added Successfully!", "success");
        }

        modal.style.display = "none";
    } catch (err) {
        console.error(err);
        window.showToast("Error: " + err.message, "error");
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
};

window.openEditModal = (id) => {
    isEditing = true;
    editId = id;
    const p = allProducts.find(x => x.id === id);
    
    document.getElementById("prod-name").value = p.name;
    document.getElementById("prod-price").value = p.price;
    document.getElementById("prod-category").value = p.category;
    document.getElementById("prod-rating").value = p.rating || 5.0;
    document.getElementById("prod-reviews").value = p.reviewsCount || 0;
    document.getElementById("prod-partner-only").checked = p.isPartnerOnly || false;
    
    imagePreview.src = p.image;
    imagePreview.style.display = "block";
    uploadPlaceholder.style.display = "none";
    uploadOverlay.style.display = "block";
    
    document.getElementById("modalTitle").innerText = "Edit Product";
    modal.style.display = "flex";
};

window.deleteProduct = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            window.showToast("Product Deleted!", "success");
        } catch (err) {
            window.showToast("Delete failed: " + err.message, "error");
        }
    }
};

// Migration Logic
document.getElementById("migrateBtn").onclick = async () => {
    const btn = document.getElementById("migrateBtn");
    if (!confirm("This will import current hardcoded products from database.js to Firestore. Continue?")) return;
    
    try {
        btn.innerText = "Migrating...";
        btn.disabled = true;
        
        const batch = writeBatch(db);
        localProducts.forEach(p => {
            const newDoc = doc(collection(db, "products"));
            batch.set(newDoc, {
                ...p,
                rating: 5.0,
                reviewsCount: 80 + Math.floor(Math.random() * 70),
                createdAt: serverTimestamp()
            });
        });
        
        await batch.commit();
        window.showToast("Migration Complete!", "success");
        btn.style.display = "none"; // Hide after success
    } catch (err) {
        window.showToast("Migration Error: " + err.message, "error");
    } finally {
        btn.innerText = "Import from local JS";
        btn.disabled = false;
    }
};

// Search Logic
document.getElementById("productSearch").oninput = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.category.toLowerCase().includes(term)
    );
    renderProducts(filtered);
};
