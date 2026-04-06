import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loginBtn = document.getElementById("partner-login-btn");
const emailInput = document.getElementById("partner-email");
const passwordInput = document.getElementById("partner-password");
const overlay = document.getElementById("partner-success-overlay");

// Initialize Auth Monitor to prevent unnecessary login if already logged in as partner
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role === "partner") {
            window.location.href = "partner-dashboard.html";
        }
    }
});

if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            window.showToast("Please enter both email and password! ⚠️", "error");
            return;
        }

        try {
            loginBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Checking Credentials...`;
            loginBtn.disabled = true;

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Verify Role
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.role === "partner") {
                    // Success!
                    window.showToast("Login Success! Welcome Partner 🤝", "success");
                    document.getElementById("display-partner-name").innerText = `${userData.showroomName || userData.firstName}`;
                    
                    // Show Overlay
                    if (overlay) {
                        overlay.style.display = "flex";
                        const progress = overlay.querySelector(".progress");
                        if (progress) {
                            progress.style.transition = "width 2.5s ease-in-out";
                            setTimeout(() => { progress.style.width = "100%"; }, 50);
                        }
                    }

                    setTimeout(() => {
                        window.location.href = "partner-dashboard.html";
                    }, 2800);
                } else if (userData.isPartnerApplicant && userData.applicationStatus === "pending") {
                    // Application Pending
                    await auth.signOut();
                    window.showToast("Application Under Review! ⏳ Our team is checking your showroom details.", "info");
                    loginBtn.innerHTML = `Partner Login <i class="fa-solid fa-handshake" style="margin-left: 8px;"></i>`;
                    loginBtn.disabled = false;
                } else {
                    // Not a partner
                    await auth.signOut();
                    window.showToast("Access Denied! 🔒 This portal is for registered partners only.", "error");
                    loginBtn.innerHTML = `Partner Login <i class="fa-solid fa-handshake" style="margin-left: 8px;"></i>`;
                    loginBtn.disabled = false;
                }
            } else {
                await auth.signOut();
                window.showToast("Account profile not found!", "error");
                loginBtn.disabled = false;
            }

        } catch (error) {
            console.error("Login Error:", error);
            let msg = "Invalid Email or Password! ❌";
            if (error.code === 'auth/invalid-credential') msg = "Incorrect credentials! 🔒";
            
            window.showToast(msg, "error");
            loginBtn.innerHTML = `Partner Login <i class="fa-solid fa-handshake" style="margin-left: 8px;"></i>`;
            loginBtn.disabled = false;
        }
    });
}

// Enter key support
[emailInput, passwordInput].forEach(input => {
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") loginBtn.click();
    });
});
