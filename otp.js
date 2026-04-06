// otp.js
// ⚠️ EMAILJS CONFIGURATION UPDATED ⚠️
const EMAILJS_PUBLIC_KEY = "Q8rEQtoseFVl5Raz0";
const EMAILJS_SERVICE_ID = "service_rp5ddd5";
const EMAILJS_TEMPLATE_ID = "template_gajiorr";

// Temporary storage for the OTP generated
let currentOTP = null;
window.isEmailVerified = false;

// Inject Premium Styles
const injectStyles = () => {
    if (document.getElementById("otp-styles")) return;
    const style = document.createElement("style");
    style.id = "otp-styles";
    style.innerHTML = `
        .otp-verify-btn {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            animation: fadeInRight 0.4s ease forwards;
        }

        .otp-verify-btn:hover {
            transform: translateY(-52%) scale(1.05);
            box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
            filter: brightness(1.1);
        }

        .otp-verify-btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            box-shadow: none;
        }

        .otp-container {
            overflow: hidden;
            max-height: 0;
            opacity: 0;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            margin-top: 0;
        }

        .otp-container.active {
            max-height: 200px;
            opacity: 1;
            margin-top: 15px;
        }

        .otp-flex {
            display: flex;
            gap: 12px;
            align-items: center;
            background: rgba(var(--card-bg-rgb), 0.1);
            backdrop-filter: blur(10px);
            padding: 4px;
            border-radius: 12px;
        }

        .otp-input-field {
            flex: 1;
            padding: 12px 16px;
            border: 1.5px solid var(--border-color);
            border-radius: 10px;
            background: var(--card-bg);
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 500;
            outline: none;
            transition: border-color 0.3s ease;
        }

        .otp-input-field:focus {
            border-color: #6366f1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .otp-submit-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .otp-submit-btn:hover {
            background: #059669;
            transform: scale(1.02);
        }

        @keyframes fadeInRight {
            from { opacity: 0; transform: translateY(-50%) translateX(10px); }
            to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }

        .verified-badge {
            color: #10b981;
            font-weight: 700;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 4px;
            animation: scaleIn 0.3s ease;
        }

        @keyframes scaleIn {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
};
document.addEventListener("DOMContentLoaded", injectStyles);

// Initialize EmailJS
const initEmailJS = () => {
    if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY_HERE") {
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
    }
};
document.addEventListener("DOMContentLoaded", initEmailJS);

// Generates a standard 6 digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Attaches the OTP verification UI to a specific email input.
 * @param {string} emailInputId - The HTML ID of the email input.
 * @param {string} submitBtnId - The HTML ID of the parent form's submit button.
 */
window.setupEmailOTP = function(emailInputId, submitBtnId) {
    const emailInput = document.getElementById(emailInputId);
    if (!emailInput) return;

    injectStyles(); // Ensure styles are injected

    const container = emailInput.parentElement;
    const submitBtn = document.getElementById(submitBtnId) || document.querySelector('.login-card .btn') || document.querySelector('.card > .btn');

    // Create Verify Button
    const verifyBtn = document.createElement("button");
    verifyBtn.type = "button";
    verifyBtn.innerHTML = "Verify";
    verifyBtn.className = "otp-verify-btn";
    verifyBtn.style.display = "none";
    
    // Ensure parent is relative for absolute positioning
    container.style.position = "relative";
    container.appendChild(verifyBtn);

    // Create OTP Input Box (Hidden initially)
    const otpContainer = document.createElement("div");
    otpContainer.className = "otp-container";
    otpContainer.innerHTML = `
        <div class="otp-flex">
            <input type="text" id="otp-input-${emailInputId}" class="otp-input-field" placeholder="Enter 6-Digit OTP" maxlength="6">
            <button type="button" id="otp-submit-${emailInputId}" class="otp-submit-btn">Verify Now</button>
        </div>
        <p id="otp-msg-${emailInputId}" style="font-size: 11px; color: var(--text-muted); margin-top: 8px; padding-left: 5px;"></p>
    `;
    
    // Insert OTP box right after the email input's container
    container.parentNode.insertBefore(otpContainer, container.nextSibling);

    const otpInput = otpContainer.querySelector(`#otp-input-${emailInputId}`);
    const otpSubmit = otpContainer.querySelector(`#otp-submit-${emailInputId}`);
    const otpMsg = otpContainer.querySelector(`#otp-msg-${emailInputId}`);

    // Track input typing to show/hide verify button
    emailInput.addEventListener("input", () => {
        let val = emailInput.value.trim().toLowerCase();
        // More flexible pattern: something@something.at-least-2-chars
        let emailPattern = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/;
        
        // Reset verification state if they modify the email
        window.isEmailVerified = false;
        if (submitBtn) {
            submitBtn.disabled = true; 
            submitBtn.style.opacity = "0.7";
        }
        
        emailInput.style.borderColor = "var(--border-color)";
        otpContainer.classList.remove("active"); 
        
        if (emailPattern.test(val)) {
            verifyBtn.style.display = "block";
            verifyBtn.innerHTML = "Verify";
            verifyBtn.disabled = false;
        } else {
            verifyBtn.style.display = "none";
        }
    });

    // Handle Verify Clicks
    verifyBtn.addEventListener("click", async () => {
        if (EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY_HERE") {
            window.showToast("EmailJS is not configured yet! Contact Admin.", "error");
            return;
        }

        const email = emailInput.value.trim();
        verifyBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        verifyBtn.disabled = true;

        currentOTP = generateOTP();

        try {
            await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                to_email: email,
                otp_code: currentOTP
            });

            window.showToast("OTP sent to your email! 📩", "success");
            verifyBtn.innerHTML = "Sent!";
            otpContainer.classList.add("active"); // Slide down
            otpMsg.innerText = "Please check your inbox (and spam folder).";
            otpMsg.style.color = "var(--text-muted)";
            
        } catch (error) {
            console.error("EmailJS Error:", error);
            window.showToast("Failed to send OTP! ❌", "error");
            verifyBtn.innerHTML = "Try Again";
            verifyBtn.disabled = false;
        }
    });

    // Handle OTP Submit
    otpSubmit.addEventListener("click", () => {
        const entered = otpInput.value.trim();
        
        if (entered === currentOTP) {
            window.isEmailVerified = true;
            window.showToast("Email Verified Successfully! ✅", "success");
            
            // UI Feedback
            otpContainer.classList.remove("active");
            
            // Premium Success Badge
            verifyBtn.style.background = "transparent";
            verifyBtn.style.boxShadow = "none";
            verifyBtn.style.cursor = "default";
            verifyBtn.innerHTML = `<div class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified</div>`;
            
            emailInput.style.borderColor = "#10b981"; 
            emailInput.readOnly = true; // Prevent changing after verification
            
            // Unlock Main Button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = "1";
            }
        } else {
            window.showToast("Incorrect OTP! ❌", "error");
            otpMsg.innerText = "Invalid OTP. Try again.";
            otpMsg.style.color = "#ef4444";
            otpInput.style.borderColor = "#ef4444";
        }
    });
};
