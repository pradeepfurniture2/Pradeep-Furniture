import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loginBtn = document.getElementById("admin-login-btn");
const emailInput = document.getElementById("admin-email");
const passInput = document.getElementById("admin-password");

async function handleAdminLogin() {
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
        window.showToast("Please enter both credentials! ⚠️", "error");
        return;
    }

    try {
        loginBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...`;
        loginBtn.disabled = true;

        // 1. Firebase Auth Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Role Check from Firestore
        const docRef = doc(db, "users", user.uid);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // If user exists in Auth but not in Firestore yet (rare), create basic doc
            const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            await setDoc(docRef, {
                email: user.email,
                firstName: "Owner",
                role: "admin",
                createdAt: new Date().toISOString()
            });
            docSnap = await getDoc(docRef);
        }

        let userData = docSnap.data();
        
        // TEMPORARY AUTO-PROMOTE: Make this user an admin if they aren't one yet
        // This allows the user to use any account they create to access the dashboard.
        if (userData.role !== "admin") {
            const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
            await updateDoc(docRef, { role: "admin" });
            userData.role = "admin";
            window.showToast("Promoted to Admin! 👑", "info");
        }

        // 👑 SHOW PREMIUM SUCCESS EXPERIENCE
        const overlay = document.getElementById("owner-success-overlay");
        if (overlay) {
            overlay.style.display = "flex";
            
            // Animate progress bar
            const progress = overlay.querySelector(".progress");
            if (progress) {
                progress.style.transition = "width 3s ease-in-out";
                setTimeout(() => { progress.style.width = "100%"; }, 50);
            }
            // Redirect after the animation
            setTimeout(() => {
                window.location.href = "admin-dashboard.html";
            }, 3200);
        } else {
            window.location.href = "admin-dashboard.html";
        }

    } catch (error) {
        console.error("Owner Login Error:", error);
        let msg = "Invalid Login Credentials! 🔒";
        if (error.code === 'auth/user-not-found') msg = "No owner account found! ⚠️";
        if (error.code === 'auth/wrong-password') msg = "Incorrect password! 🚫";
        
        window.showToast(msg, "error");
        
        loginBtn.innerHTML = `Secure Login <i class="fa-solid fa-shield-halved" style="margin-left: 8px;"></i>`;
        loginBtn.disabled = false;
    }
}

// Event Listeners
loginBtn.addEventListener("click", handleAdminLogin);

// Enter key support
passInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAdminLogin();
});
// Forgot Password Logic
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

window.forgotPassword = async function() {
    let email = emailInput.value.trim();
    if (!email) {
        email = prompt("Enter your Owner Email address for reset link:");
        if (!email) return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        window.showToast("Success! Password reset link sent. 📩", "success");
    } catch (error) {
        window.showToast("Error: " + error.message, "error");
    }
};
