// auth.js
import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  sendPasswordResetEmail,
  confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc,
  query,
  where,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* USERNAME CHECK HELPER */
window.checkUsernameAvailability = async function(username) {
  if (!username) return true;
  try {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty; // Returns true if available
  } catch (error) {
    console.error("Username check error:", error);
    return true;
  }
};
import { 
  googleProvider, 
  githubProvider, 
  twitterProvider 
} from "./firebase.js";

// Helper to get redirection URL
const getRedirectUrl = (role = 'user') => {
  // 1. Check URL Params (highest priority)
  const params = new URLSearchParams(window.location.search);
  if (params.get("redirect")) return params.get("redirect");

  // 2. Check localStorage (was set by another page)
  const url = localStorage.getItem("authRedirect");
  localStorage.removeItem("authRedirect"); // Clear after use
  
  if (url) return url;
  
  // Role-based defaults
  if (role === 'admin') return "admin-dashboard.html";
  if (role === 'partner') return "partner-dashboard.html";
  return "dashboard.html";
};

// Record current page as redirect target if not auth page
if (!window.location.pathname.includes("login.html") && 
    !window.location.pathname.includes("admin-login.html") &&
    !window.location.pathname.includes("signup.html")) {
    localStorage.setItem("authRedirect", window.location.href);
}


/* SIGNUP FUNCTION */
window.signup = async function() {
  const firstName = document.getElementById("firstname").value;
  const lastName = document.getElementById("lastname").value;
  const username = document.getElementById("username").value;
  let emailValue = document.getElementById("email")?.value.trim() || "";
  let mobileValue = document.getElementById("mobile")?.value.trim() || "";
  let email = emailValue || mobileValue;
  const password = document.getElementById("password").value;

  if(/^[0-9]{10}$/.test(email)){
    email = email + "@mobile.com";
  } else if (email) {
    // If it's a real email, require verification
    if (window.isEmailVerified !== undefined && !window.isEmailVerified) {
        window.showToast("Please verify your email first! ⚠️", "error");
        return;
    }
  }

  if(!email || !password || !firstName || !username) {
    window.showToast("Please fill all required fields!", "error");
    return;
  }

  if(password.length < 8) {
    window.showToast("Password must be at least 8 characters long! 🔒", "error");
    return;
  }

  try {
    // 1. Check if username is already taken
    const isAvailable = await window.checkUsernameAvailability(username);
    if (!isAvailable) {
      window.showToast("Username is already taken! ❌", "error");
      return;
    }

    // 2. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save additional details in Firestore
    await setDoc(doc(db, "users", user.uid), {
      firstName: firstName,
      lastName: lastName,
      username: username,
      email: email,
      role: "user", // Default Role
      createdAt: new Date().toISOString()
    });

    window.showToast("Account Created Successfully! 🎉", "success");
    
    // Redirect back to where the user was before
    setTimeout(() => {
        window.location.href = getRedirectUrl();
    }, 1500);

  } catch (error) {
    window.showToast("Signup Error: " + error.message, "error");
  }
};
/* --- PASS RESET --- */
window.forgotPassword = async function(manualEmail = null) {
  let email = manualEmail || document.getElementById("login-email")?.value.trim() || document.getElementById("reset-email")?.value.trim();
  
  if (!email) {
    if (!manualEmail) {
        email = prompt("Enter your registered email address to receive a reset link:");
        if (!email) return false;
    } else {
        window.showToast("Please enter your email! ✉️", "error");
        return false;
    }
  }

  const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;
  if (!emailPattern.test(email)) {
    window.showToast("Please enter a valid email address! ✉️", "error");
    return false;
  }

  try {
    // 1. Manually check if this email exists in our Firestore users collection
    // This provides better UX so users know if they have an account
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      window.showToast("No account found with this email! ⚠️ Check your spelling.", "error");
      return false;
    }

    // 2. If it exists, send the reset link
    await sendPasswordResetEmail(auth, email);
    window.showToast("Success! Check your inbox for the reset link. 📩", "success");
    return true;
  } catch (error) {
    console.error("Reset Error:", error);
    let msg = "Failed to send reset email. ❌";
    window.showToast(msg, "error");
    return false;
  }
};

/* --- CONFIRM PASS RESET (Final Step) --- */
window.confirmPasswordReset = async function(oobCode, newPassword) {
    try {
        await confirmPasswordReset(auth, oobCode, newPassword);
        window.showToast("Password updated successfully! 🎉", "success");
        return true;
    } catch (error) {
        console.error("Confirm Reset Error:", error);
        let msg = "Failed to reset password.";
        if (error.code === 'auth/expired-action-code') msg = "Reset link has expired! 🚫";
        else if (error.code === 'auth/invalid-action-code') msg = "Invalid reset link! ⚠️";
        
        window.showToast(msg, "error");
        return false;
    }
};

/* LOGIN FUNCTION */
window.login = async function() {
  let emailValue = document.getElementById("login-email")?.value.trim() || "";
  let mobileValue = document.getElementById("login-mobile")?.value.trim() || "";
  let email = emailValue || mobileValue;
  const password = document.getElementById("login-password").value;
  const loginBtn = document.querySelector(".login-card .btn");
  const originalBtnText = loginBtn ? loginBtn.innerText : "Login";

  if(/^[0-9]{10}$/.test(email)){
    email = email + "@mobile.com";
  } else if (email && emailValue) {
    // If they typed an email, require verification
    if (window.isEmailVerified !== undefined && !window.isEmailVerified) {
        window.showToast("Please verify your email first! ⚠️", "error");
        return;
    }
  }

  if(!email || !password) {
    window.showToast("Please enter email and password! ⚠️", "error");
    return;
  }

  try {
    if (loginBtn) {
      loginBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Checking...`;
      loginBtn.disabled = true;
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Fetch role for immediate redirection logic
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    const role = userData ? userData.role : 'user';

    window.showToast("Login Success! Welcome back 👋", "success");
    
    setTimeout(() => {
      window.location.href = getRedirectUrl(role);
    }, 1200);

  } catch (error) {
    console.error("Login Error:", error);
    let msg = "Invalid Email or Password! ❌";
    if (error.code === 'auth/user-not-found') msg = "Account not found! ⚠️";
    if (error.code === 'auth/wrong-password') msg = "Incorrect password! 🔒";
    
    window.showToast(msg, "error");

    if (loginBtn) {
      loginBtn.innerText = originalBtnText;
      loginBtn.disabled = false;
    }
  }
};

/* LOGOUT FUNCTION */
window.logout = async function() {
  try {
    await signOut(auth);
    window.showToast("Logged Out Successfully!", "success");
    setTimeout(() => {
        window.location.reload();
    }, 1000);
  } catch (error) {
    console.error("Logout Error", error);
  }
};

/* SOCIAL LOGIN FUNCTIONS */
const handleSocialLogin = async (provider, event) => {
  const btn = event?.currentTarget;
  const originalHTML = btn ? btn.innerHTML : "";

  try {
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Loading...`;
      btn.disabled = true;
    }

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user already exists in Firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const name = user.displayName || "New User";
      const email = user.email || `user${Math.floor(Math.random() * 1000)}@social.com`;
      const nameParts = name.split(" ");

      await setDoc(docRef, {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" "),
        username: (email.split("@")[0] + Math.floor(Math.random() * 1000)).toLowerCase(),
        email: email,
        createdAt: new Date().toISOString(),
        isSocial: true
      });
    }

    window.showToast(`Welcome back, ${user.displayName}! 👋`, "success");

    setTimeout(() => {
      window.location.href = getRedirectUrl();
    }, 1200);

  } catch (error) {
    console.error("Social Auth Error:", error);
    let msg = "Social Login Failed! ❌";
    
    // Handle specific social errors
    if (error.code === 'auth/popup-closed-by-user') msg = "Popup closed by user. 🔒";
    else if (error.code === 'auth/operation-not-allowed') msg = "This method is not enabled in Firebase! 🚫";
    else if (error.code === 'auth/account-exists-with-different-credential') msg = "Email already linked! ⚠️";
    else if (error.code === 'auth/unauthorized-domain') msg = "This domain is not allowed. Use Live Server! 🌐";
    else msg = `Login Failed: ${error.message} (${error.code})`;
    
    window.showToast(msg, "error");

    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }
};

window.googleLogin = (e) => handleSocialLogin(googleProvider, e);
window.githubLogin = (e) => handleSocialLogin(githubProvider, e);
window.twitterLogin = (e) => handleSocialLogin(twitterProvider, e);


/* GLOBAL UI UPDATER */
window.updateWishlistCount = function() {
  setTimeout(() => {
    const countEl = document.getElementById("wishlist-count");
    const wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
    if (countEl) countEl.innerText = wishlist.length;
    
    // Pulse animation if empty (reusing styles from index if present)
    const icon = countEl?.parentElement?.querySelector("i");
    if (icon) {
      if (wishlist.length === 0) icon.parentElement.classList.add("heart-pulse");
      else icon.parentElement.classList.remove("heart-pulse");
    }
    
    // Sync Dashboard if on that page
    const dashCount = document.getElementById("dash-wishlist-count");
    if (dashCount) dashCount.innerText = wishlist.length;
  }, 100);
};

/* MONITOR AUTH STATE */
onAuthStateChanged(auth, async (user) => {
  const userDisplay = document.getElementById("user-name");
  const authBtn = document.querySelector(".auth-btn");
  const parentA = authBtn ? authBtn.closest('a') : null;

  if (user) {
    // User is signed in
    const docRef = doc(db, "users", user.uid);
    let docSnap = await getDoc(docRef);

    // EMERGENCY RECOVERY: Auto-recreate missing user document if database was cleared
    if (!docSnap.exists()) {
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const fallbackName = user.displayName ? user.displayName.split(" ")[0] : "User";
      await setDoc(docRef, {
        firstName: fallbackName,
        lastName: "",
        email: user.email || "recovered@user.com",
        role: "admin", // Default auto-promote for dev recovery
        createdAt: new Date().toISOString()
      });
      window.showToast("Database recovered for your account! 🛠️", "success");
      docSnap = await getDoc(docRef);
    }

    if (docSnap.exists()) {
      const userData = docSnap.data();
      
      // SYNC WISHLIST FROM ACCOUNT
      if (userData.wishlist) {

        localStorage.setItem("wishlist", JSON.stringify(userData.wishlist));
        window.updateWishlistCount();
        // Notify other scripts/tabs
        window.dispatchEvent(new Event("wishlistUpdated"));
      }

      if (userDisplay) {
        const dashboardLink = userData.role === 'partner' ? 'partner-dashboard.html' : 
                            (userData.role === 'admin' ? 'admin-dashboard.html' : 'dashboard.html');
        userDisplay.innerHTML = `<a href="${dashboardLink}" class="user-profile-link" style="display:inline-block;">Hi, ${userData.firstName}</a>`;
        userDisplay.style.display = "inline-block";
      }
      if (authBtn) {
        authBtn.style.display = "none"; 
      }
    }
  } else {
    // User is signed out -> CLEAR WISHLIST
    localStorage.removeItem("wishlist");
    window.updateWishlistCount();
    window.dispatchEvent(new Event("wishlistUpdated"));

    if (userDisplay) {
        userDisplay.innerHTML = "";
        userDisplay.style.display = "none";
    }
    if (authBtn) {
      authBtn.style.display = "inline-block"; 
      authBtn.innerText = "Login / Signup";
      if (parentA) parentA.href = "login.html";
    }
  }
  
  // Show the nav-right section once auth state is determined to prevent flicker
  const navRight = document.querySelector(".nav-right");
  if (navRight) navRight.style.opacity = "1";

  // Auto-redirect AWAY from login/signup if already logged in
  const path = window.location.pathname;
  if (user && (path.includes("login.html") || path.includes("signup.html"))) {
    window.location.href = "dashboard.html";
  }
  
  // OWNER REDIRECT: If already logged in as admin, go to admin dashboard from admin-login
  if (user && path.includes("admin-login.html")) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().role === "admin") {
      window.location.href = "admin-dashboard.html";
    }
  }
});