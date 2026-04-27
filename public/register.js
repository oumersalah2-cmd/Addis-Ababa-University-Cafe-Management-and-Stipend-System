// ── Helpers ──────────────────────────────────────────────────────────────────

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("toast-visible"), 50);
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    await response.text();
    throw new Error("Server returned non-JSON response. Please refresh.");
  }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const studentForm   = document.getElementById("studentForm");
const inp_cafe      = document.getElementById("inp_cafe");
const bankLabel     = document.getElementById("bankLabel");
const inp_bank      = document.getElementById("inp_bank");
const inp_password  = document.getElementById("inp_password");
const inp_confirm   = document.getElementById("inp_confirm");
const pwFill        = document.getElementById("pwFill");
const pwLabel       = document.getElementById("pwLabel");
const inp_dept      = document.getElementById("inp_dept");
const submitBtn     = document.getElementById("submitBtn");

// ── Stepper state ─────────────────────────────────────────────────────────────

let currentStep = 1;
const TOTAL_STEPS = 4;

function goToStep(n) {
  // Hide all pages
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const page = document.getElementById(`step${i}`);
    const item = document.getElementById(`stepItem${i}`);
    if (page) page.classList.remove("active");
    if (item) {
      item.classList.remove("active", "done");
      if (i < n) item.classList.add("done");
      else if (i === n) item.classList.add("active");
    }
    if (i < TOTAL_STEPS) {
      const conn = document.getElementById(`conn${i}`);
      if (conn) conn.classList.toggle("done", i < n);
    }
  }
  const target = document.getElementById(`step${n}`);
  if (target) target.classList.add("active");
  currentStep = n;
}

// ── Step validation ───────────────────────────────────────────────────────────

function validateStep(n) {
  if (n === 1) {
    const id    = document.getElementById("inp_student_id").value.trim();
    const year  = Number(document.getElementById("inp_year").value);
    const first = document.getElementById("inp_first").value.trim();
    const last  = document.getElementById("inp_last").value.trim();
    if (!id)              { showToast("Student ID is required.", "error"); return false; }
    if (!first)           { showToast("First name is required.", "error"); return false; }
    if (!last)            { showToast("Last name is required.", "error"); return false; }
    if (!year || year < 1 || year > 7) { showToast("Year of study must be between 1 and 7.", "error"); return false; }
    return true;
  }
  if (n === 2) {
    const dept = inp_dept.value;
    if (!dept) { showToast("Please select your department.", "error"); return false; }
    return true;
  }
  if (n === 3) {
    const cafeStatus = inp_cafe.value;
    if (cafeStatus === "NON_CAFE") {
      const bank = inp_bank.value.trim();
      if (!bank) { showToast("Bank account number is required for NON-CAFE students.", "error"); return false; }
    }
    return true;
  }
  if (n === 4) {
    const username = document.getElementById("inp_username").value.trim();
    const password = inp_password.value;
    const confirm  = inp_confirm.value;
    if (!username) { showToast("Username is required.", "error"); return false; }
    if (username.length < 3) { showToast("Username must be at least 3 characters.", "error"); return false; }
    if (!checkPasswordStrength(password)) {
      showToast("Password must be 8+ chars with uppercase, lowercase, and a number.", "error");
      return false;
    }
    if (password !== confirm) { showToast("Passwords do not match.", "error"); return false; }
    return true;
  }
  return true;
}

// ── Password strength ─────────────────────────────────────────────────────────

function checkPasswordStrength(pw) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);
}

function updateStrengthBar(pw) {
  let level = "weak";
  let label = "Weak";
  if (!pw) {
    pwFill.className = "pw-strength-fill";
    pwFill.style.width = "0%";
    pwLabel.textContent = "Enter a password";
    pwLabel.className = "pw-strength-label";
    return;
  }
  const hasLen  = pw.length >= 8;
  const hasLow  = /[a-z]/.test(pw);
  const hasUp   = /[A-Z]/.test(pw);
  const hasNum  = /\d/.test(pw);
  const hasSym  = /[^a-zA-Z\d]/.test(pw);
  const score   = [hasLen, hasLow, hasUp, hasNum, hasSym].filter(Boolean).length;
  if (score <= 2)      { level = "weak";   label = "Weak"; }
  else if (score <= 3) { level = "medium"; label = "Medium"; }
  else                 { level = "strong"; label = "Strong"; }
  pwFill.className = `pw-strength-fill ${level}`;
  pwLabel.textContent = label;
  pwLabel.className = `pw-strength-label ${level}`;
}

// ── Cafe toggle ───────────────────────────────────────────────────────────────

function toggleCafeFields() {
  const isNonCafe = inp_cafe.value === "NON_CAFE";
  if (bankLabel) bankLabel.style.display = isNonCafe ? "flex" : "none";
  if (inp_bank)  inp_bank.required = isNonCafe;
  if (!isNonCafe && inp_bank) inp_bank.value = "";
}

// ── Dept loading ──────────────────────────────────────────────────────────────

async function loadDepartments() {
  try {
    const data = await fetchJSON("/api/departments");
    inp_dept.innerHTML = data.data
      .map((d) => `<option value="${d.dept_id}">${d.dept_name}</option>`)
      .join("");
  } catch {
    inp_dept.innerHTML = '<option value="">Failed to load — refresh page</option>';
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateStep(4)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Registering...";

  const formData = new FormData(studentForm);
  const payload = Object.fromEntries(formData.entries());
  payload.year_of_study = Number(payload.year_of_study);
  payload.dept_id = Number(payload.dept_id);
  if (payload.cafe_status === "CAFE") payload.bank_account_number = "";

  try {
    await fetchJSON("/api/students/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("Registration submitted! Redirecting to login...", "success");
    setTimeout(() => {
      const username = encodeURIComponent(payload.username || "");
      window.location.href = `/student?registered=1&username=${username}`;
    }, 1400);
  } catch (error) {
    showToast(error.message, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
  }
});

// ── Step navigation ───────────────────────────────────────────────────────────

document.getElementById("next1").addEventListener("click", () => {
  if (validateStep(1)) goToStep(2);
});
document.getElementById("prev2").addEventListener("click", () => goToStep(1));
document.getElementById("next2").addEventListener("click", () => {
  if (validateStep(2)) goToStep(3);
});
document.getElementById("prev3").addEventListener("click", () => goToStep(2));
document.getElementById("next3").addEventListener("click", () => {
  if (validateStep(3)) goToStep(4);
});
document.getElementById("prev4").addEventListener("click", () => goToStep(3));

// ── Event listeners ───────────────────────────────────────────────────────────

inp_cafe.addEventListener("change", toggleCafeFields);
inp_password.addEventListener("input", () => updateStrengthBar(inp_password.value));

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  toggleCafeFields();
  await loadDepartments();
}

boot();
