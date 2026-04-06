/* toast.js */
function showToast(message, type = "success", duration = 4000) {
  // 1. Check if toast container exists
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // 2. Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";

  toast.innerHTML = `
    <div class="toast-content">
      <i class="fa-solid ${icon} toast-icon"></i>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    <div class="toast-progress"></div>
  `;

  // 3. Append to container
  container.appendChild(toast);

  // 4. Progress bar animation
  const progress = toast.querySelector(".toast-progress");
  progress.style.transition = `width ${duration}ms linear`;
  setTimeout(() => {
    progress.style.width = "0%";
  }, 10);

  // 5. Automatic removal
  setTimeout(() => {
    toast.classList.add("hiding");
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 400);
  }, duration);
}

// Attach to window object for global access
window.showToast = showToast;

function showConfirmDialog(title, message, onConfirm) {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";

  // Create modal content
  const modal = document.createElement("div");
  modal.className = "confirm-modal";
  
  modal.innerHTML = `
    <div class="confirm-modal-icon">
        <i class="fa-solid fa-cookie-bite"></i>
    </div>
    <div class="confirm-modal-title">${title}</div>
    <div class="confirm-modal-text">${message}</div>
    <div class="confirm-modal-actions">
      <button class="confirm-btn cancel" id="confirm-cancel-btn">Cancel</button>
      <button class="confirm-btn approve" id="confirm-approve-btn">Yes, Setup</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close function
  const closeModal = () => {
    overlay.style.animation = "fadeInOverlay 0.3s reverse forwards";
    modal.style.animation = "popInModal 0.3s reverse forwards";
    setTimeout(() => overlay.remove(), 300);
  };

  // Event listeners
  modal.querySelector("#confirm-cancel-btn").addEventListener("click", closeModal);
  modal.querySelector("#confirm-approve-btn").addEventListener("click", () => {
    closeModal();
    if (typeof onConfirm === "function") onConfirm();
  });
}

window.showConfirmDialog = showConfirmDialog;

function showPromptDialog(title, defaultValue, onSubmit) {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";

  // Create modal content
  const modal = document.createElement("div");
  modal.className = "confirm-modal prompt-modal";
  
  modal.innerHTML = `
    <div class="confirm-modal-icon">
        <i class="fa-solid fa-pen-to-square"></i>
    </div>
    <div class="confirm-modal-title" style="margin-bottom:15px; font-size:18px;">${title}</div>
    <input type="text" class="prompt-input" value="${defaultValue || ""}" style="width:100%; padding:14px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-primary); margin-bottom:25px; font-size:15px; outline:none; transition: border-color 0.3s ease;" placeholder="Type here..." />
    <div class="confirm-modal-actions">
      <button class="confirm-btn cancel" id="prompt-cancel-btn">Cancel</button>
      <button class="confirm-btn approve" id="prompt-submit-btn">Continue</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const inputEl = modal.querySelector(".prompt-input");
  inputEl.focus();

  // Focus effect
  inputEl.addEventListener("focus", () => inputEl.style.borderColor = "var(--accent-color)");
  inputEl.addEventListener("blur", () => inputEl.style.borderColor = "var(--border-color)");

  // Press Enter to submit
  inputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        modal.querySelector("#prompt-submit-btn").click();
    }
  });

  // Close function
  const closeModal = () => {
    overlay.style.animation = "fadeInOverlay 0.3s reverse forwards";
    modal.style.animation = "popInModal 0.3s reverse forwards";
    setTimeout(() => overlay.remove(), 300);
  };

  // Event listeners
  modal.querySelector("#prompt-cancel-btn").addEventListener("click", () => {
    closeModal();
    if (typeof onSubmit === "function") onSubmit(null); 
  });
  
  modal.querySelector("#prompt-submit-btn").addEventListener("click", () => {
    const val = inputEl.value;
    closeModal();
    if (typeof onSubmit === "function") onSubmit(val);
  });
}

window.showPromptDialog = showPromptDialog;
