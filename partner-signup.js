import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const signupForm = document.getElementById("partner-registration-form");
const submitBtn = document.getElementById("submit-btn");
const signupCard = document.getElementById("signup-card");
const successStep = document.getElementById("success-step");

if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const firstName = document.getElementById("p-firstname").value.trim();
        const lastName = document.getElementById("p-lastname").value.trim();
        const showroomName = document.getElementById("p-showroom").value.trim();
        const email = document.getElementById("p-email").value.trim();
        const phone = document.getElementById("p-phone").value.trim();
        const city = document.getElementById("p-city").value.trim();
        const address = document.getElementById("p-address").value.trim();
        const password = document.getElementById("p-password").value;

        if (password.length < 8) {
            window.showToast("Password must be at least 8 characters! 🔒", "error");
            return;
        }

        try {
            submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...`;
            submitBtn.disabled = true;

            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Create User Document in Firestore
            await setDoc(doc(db, "users", user.uid), {
                firstName,
                lastName,
                email,
                role: "user", // Default until approved
                isPartnerApplicant: true,
                showroomName,
                phone,
                city,
                address,
                applicationStatus: "pending",
                createdAt: serverTimestamp()
            });

            // 3. Immediately Sign Out (since they're not approved as partner yet)
            await signOut(auth);

            // 4. Show Success State
            signupForm.style.display = "none";
            successStep.style.display = "block";
            window.showToast("Application submitted successfully! ✨", "success");

        } catch (error) {
            console.error("Partner Signup Error:", error);
            let msg = "Signup Failed! ❌";
            if (error.code === 'auth/email-already-in-use') msg = "Email already registered! ⚠️";
            window.showToast(msg, "error");
            submitBtn.innerHTML = `Submit Application <i class="fa-solid fa-paper-plane" style="margin-left: 8px;"></i>`;
            submitBtn.disabled = false;
        }
    });
}
