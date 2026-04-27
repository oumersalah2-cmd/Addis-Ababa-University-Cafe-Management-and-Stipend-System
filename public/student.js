// ── Toast ─────────────────────────────────────────────────────────────────────

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

// ── API helpers ───────────────────────────────────────────────────────────────

let authToken = "";

async function fetchJSON(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, { headers, ...options });
  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    await response.text();
    throw new Error("Server returned invalid response. Please refresh.");
  }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function postFormData(url, formData) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, { method: "POST", headers, body: formData });
  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) data = await response.json();
  else { await response.text(); throw new Error("Invalid server response. Please refresh."); }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const loginView            = document.getElementById("loginView");
const portalContent        = document.getElementById("portalContent");
const studentLoginForm     = document.getElementById("studentLoginForm");
const studentLoginMessage  = document.getElementById("studentLoginMessage");
const loginBtn             = document.getElementById("loginBtn");
const studentLogoutBtn     = document.getElementById("studentLogoutBtn");
const pendingBanner        = document.getElementById("pendingBanner");

const profileAvatar        = document.getElementById("profileAvatar");
const profileName          = document.getElementById("profileName");
const profileStudentId     = document.getElementById("profileStudentId");
const profileBadges        = document.getElementById("profileBadges");
const detailsGrid          = document.getElementById("detailsGrid");

const stipendSection       = document.getElementById("stipendSection");
const mealsSection         = document.getElementById("mealsSection");
const stipendTimeline      = document.getElementById("stipendTimeline");
const stipendSummaryBadge  = document.getElementById("stipendSummaryBadge");
const mealCardDisplay      = document.getElementById("mealCardDisplay");
const mealHistoryList      = document.getElementById("mealHistoryList");

const feedbackForm         = document.getElementById("feedbackForm");
const feedbackMsgEl        = document.getElementById("feedbackMsgEl");
const feedbackList         = document.getElementById("feedbackList");
const feedbackCategory     = document.getElementById("feedbackCategory");
const feedbackPhoto        = document.getElementById("feedbackPhoto");
const photoPreviewBox      = document.getElementById("photoPreviewBox");
const photoPreviewImg      = document.getElementById("photoPreviewImg");
const paymentsTabBtn       = document.getElementById("paymentsTabBtn");

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const target = document.getElementById(`tab${capitalizeFirst(btn.dataset.tab)}`);
    if (target) target.classList.add("active");
  });
});

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Photo preview ─────────────────────────────────────────────────────────────

if (feedbackPhoto) {
  feedbackPhoto.addEventListener("change", () => {
    const file = feedbackPhoto.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        photoPreviewImg.src = e.target.result;
        photoPreviewBox.classList.add("visible");
      };
      reader.readAsDataURL(file);
    } else {
      photoPreviewBox.classList.remove("visible");
    }
  });
}

// ── Profile card ──────────────────────────────────────────────────────────────

function renderProfileCard(p) {
  const initials = `${p.first_name.charAt(0)}${p.last_name.charAt(0)}`.toUpperCase();
  profileAvatar.textContent = initials;
  profileName.textContent   = `${p.first_name} ${p.last_name}`;
  profileStudentId.textContent = p.student_id;

  const cafeClass    = p.cafe_status === "CAFE" ? "badge-cafe" : "badge-non-cafe";
  const cafeLabel    = p.cafe_status === "CAFE" ? "Cafe" : "Non-Cafe";
  const approvedHtml = p.is_approved
    ? `<span class="badge badge-approved">Approved</span>`
    : `<span class="badge badge-pending">Pending Approval</span>`;

  profileBadges.innerHTML = `
    <span class="badge ${cafeClass}">${cafeLabel}</span>
    ${approvedHtml}
    <span class="badge" style="background:rgba(255,255,255,0.05);color:var(--aau-text-muted);border:1px solid var(--glass-border);">Year ${p.year_of_study}</span>
  `;

  if (pendingBanner) pendingBanner.style.display = p.is_approved ? "none" : "flex";
}

// ── Details grid ──────────────────────────────────────────────────────────────

function renderDetailsGrid(p) {
  const dorm = p.block_name && p.dorm_number ? `Block ${p.block_name}, Room ${p.dorm_number}` : "Not assigned";
  const items = [
    { label: "Student ID",    value: p.student_id },
    { label: "Full Name",     value: `${p.first_name} ${p.last_name}` },
    { label: "Department",    value: p.dept_name },
    { label: "Year of Study", value: `Year ${p.year_of_study}` },
    { label: "Student Type",  value: p.cafe_status === "CAFE" ? "Cafe (Cafeteria)" : "Non-Cafe (Stipend)" },
    { label: "Dormitory",     value: dorm },
    ...(p.cafe_status === "CAFE"
      ? [{ label: "Meal Card", value: p.meal_card_number || "Not assigned" }]
      : [{ label: "Bank Account", value: p.bank_account_number || "Not provided" }]),
    { label: "Account Status", value: p.is_approved ? "Active & Approved" : "Pending Admin Approval" },
  ];
  detailsGrid.innerHTML = items
    .map((i) => `<div class="detail-item"><div class="detail-label">${i.label}</div><div class="detail-value">${i.value}</div></div>`)
    .join("");
}

// ── Stipend timeline ──────────────────────────────────────────────────────────

function buildAcademicMonths() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const startYear = m >= 9 ? y : y - 1;
  return [
    { y: startYear,   m:  9, label: "September",  eth: "Meskerem" },
    { y: startYear,   m: 10, label: "October",    eth: "Tikimt" },
    { y: startYear,   m: 11, label: "November",   eth: "Hidar" },
    { y: startYear,   m: 12, label: "December",   eth: "Tahsas" },
    { y: startYear+1, m:  1, label: "January",    eth: "Tir" },
    { y: startYear+1, m:  2, label: "February",   eth: "Yekatit" },
    { y: startYear+1, m:  3, label: "March",      eth: "Megabit" },
    { y: startYear+1, m:  4, label: "April",      eth: "Miyazya" },
    { y: startYear+1, m:  5, label: "May",        eth: "Ginbot" },
    { y: startYear+1, m:  6, label: "June",       eth: "Sene" },
  ].map((x) => ({
    ...x,
    key: `${x.y}-${String(x.m).padStart(2, "0")}-01`,
  }));
}

function renderStipendTimeline(stipendHistory) {
  const months = buildAcademicMonths();
  const map = new Map((stipendHistory || []).map((s) => [String(s.stipend_month).slice(0, 10), s]));

  const paidCount = [...map.values()].filter((s) => s.status === "PAID").length;
  if (stipendSummaryBadge) {
    stipendSummaryBadge.textContent = `${paidCount} / 10 paid`;
    stipendSummaryBadge.className = paidCount > 0 ? "status-badge status-paid" : "status-badge status-pending";
  }

  stipendTimeline.innerHTML = months.map((mo) => {
    const rec    = map.get(mo.key);
    const status = rec ? rec.status.toLowerCase() : "not_created";
    const dotClass = rec
      ? (rec.status === "PAID" ? "paid" : rec.status === "PENDING" ? "pending" : "failed")
      : "";
    const statusText = !rec
      ? "Not yet created"
      : rec.status === "PAID"
      ? `Paid — ${String(rec.confirmed_at || "").slice(0, 10)}`
      : rec.status === "PENDING"
      ? "On the way — awaiting confirmation"
      : "Failed — contact admin";
    const badgeClass = !rec
      ? "status-failed"
      : rec.status === "PAID" ? "status-paid" : rec.status === "PENDING" ? "status-pending" : "status-failed";
    const dotLabel = mo.label.slice(0, 3).toUpperCase();
    const amount = rec ? `${parseFloat(rec.amount).toLocaleString()} ETB` : "3,000 ETB";

    return `
      <div class="timeline-item">
        <div class="timeline-dot ${dotClass}" aria-label="${mo.label} stipend status">${dotLabel}</div>
        <div class="timeline-body">
          <div>
            <div class="timeline-month">${mo.label} <span style="color:var(--aau-text-muted);font-size:0.8rem;font-weight:400;">(${mo.eth})</span></div>
            <div class="timeline-amount">${amount}</div>
          </div>
          <div class="timeline-right">
            <span class="status-badge ${badgeClass}">${rec ? rec.status : "PENDING"}</span>
            <div style="font-size:0.75rem;color:var(--aau-text-muted);margin-top:0.35rem;">${statusText}</div>
          </div>
        </div>
      </div>`;
  }).join("");
}

// ── Meals ─────────────────────────────────────────────────────────────────────

function renderMealHistory(recentMeals) {
  const today = new Date().toISOString().slice(0, 10);
  const todayMeals = new Set(
    (recentMeals || [])
      .filter((m) => String(m.date_time).slice(0, 10) === today)
      .map((m) => m.meal_type)
  );

  ["BREAKFAST", "LUNCH", "DINNER"].forEach((type) => {
    const slot   = document.getElementById(`slot-${type}`);
    const status = document.getElementById(`meal-status-${type}`);
    const btn    = document.getElementById(`mealBtn-${type}`);
    if (!slot) return;
    if (todayMeals.has(type)) {
      slot.classList.add("taken");
      if (status) status.textContent = "Logged today";
      if (btn)   { btn.disabled = true; btn.textContent = "Already logged"; }
    } else {
      slot.classList.remove("taken");
      if (status) status.textContent = "Not logged";
      if (btn)   { btn.disabled = false; btn.textContent = `Log ${type.charAt(0) + type.slice(1).toLowerCase()}`; }
    }
  });

  if (!mealHistoryList) return;
  if (!recentMeals || !recentMeals.length) {
    mealHistoryList.innerHTML = "<li style='color:var(--aau-text-muted);'>No meal history yet.</li>";
    return;
  }
  mealHistoryList.innerHTML = recentMeals.slice(0, 10).map((m) => {
    const dt = String(m.date_time).replace("T", " ").slice(0, 16);
    return `<li style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;">
      <span>${m.meal_type.charAt(0) + m.meal_type.slice(1).toLowerCase()}</span>
      <span style="color:var(--aau-text-muted);font-size:0.82rem;">${dt}</span>
    </li>`;
  }).join("");
}

window.logMeal = async function (mealType) {
  const btn = document.getElementById(`mealBtn-${mealType}`);
  if (btn) { btn.disabled = true; btn.textContent = "Logging..."; }
  try {
    await fetchJSON("/api/meals/log", {
      method: "POST",
      body: JSON.stringify({ meal_type: mealType }),
    });
    showToast(`${mealType.charAt(0) + mealType.slice(1).toLowerCase()} logged successfully!`, "success");
    await refreshPortal();
  } catch (e) {
    showToast(e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = `Log ${mealType.charAt(0) + mealType.slice(1).toLowerCase()}`; }
  }
};

// ── Feedback ──────────────────────────────────────────────────────────────────

function renderFeedbackList(items) {
  if (!items || !items.length) {
    feedbackList.innerHTML = "<li style='color:var(--aau-text-muted);'>No feedback submitted yet.</li>";
    return;
  }
  feedbackList.innerHTML = items.map((f) => {
    const badgeClass = f.status === "RESOLVED" ? "status-paid" : f.status === "IN_REVIEW" ? "status-pending" : "status-failed";
    const photo = f.photo_path
      ? `<div style="margin-top:0.75rem;"><a href="${f.photo_path}" target="_blank" rel="noopener" style="color:var(--aau-accent);">View attached photo</a></div>`
      : "";
    const note = f.admin_note
      ? `<div style="margin-top:0.75rem;padding:0.7rem 1rem;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.85rem;"><strong>Admin:</strong> ${f.admin_note}</div>`
      : "";
    const dt = String(f.created_at).replace("T", " ").slice(0, 16);
    return `<li>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <span class="badge ${f.category === 'FOOD' ? 'badge-cafe' : 'badge-non-cafe'}">${f.category}</span>
        <span class="status-badge ${badgeClass}">${f.status}</span>
      </div>
      <div style="line-height:1.55;">${f.message}</div>
      ${photo}${note}
      <div style="margin-top:0.6rem;color:rgba(255,255,255,0.45);font-size:0.78rem;">${dt}</div>
    </li>`;
  }).join("");
}

async function loadMyFeedback() {
  try {
    const data = await fetchJSON("/api/feedback/me");
    renderFeedbackList(data.data);
  } catch (e) {
    feedbackList.innerHTML = `<li style='color:var(--aau-error);'>${e.message}</li>`;
  }
}

feedbackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("feedbackMessage").value.trim();
  if (!msg) { showToast("Please write your message.", "error"); return; }

  const submitBtn = document.getElementById("feedbackSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const formData = new FormData(feedbackForm);
  try {
    await postFormData("/api/feedback", formData);
    showToast("Feedback submitted successfully!", "success");
    feedbackForm.reset();
    photoPreviewBox.classList.remove("visible");
    feedbackMsgEl.textContent = "";
    await loadMyFeedback();
  } catch (err) {
    showToast(err.message, "error");
    feedbackMsgEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Feedback";
  }
});

// ── Load all portal data ──────────────────────────────────────────────────────

let cachedProfile = null;

async function refreshPortal() {
  const data = await fetchJSON("/api/students/me");
  const p    = data.data.profile;
  cachedProfile = p;

  renderProfileCard(p);
  renderDetailsGrid(p);

  if (p.cafe_status === "NON_CAFE") {
    if (stipendSection) stipendSection.style.display = "block";
    if (mealsSection)   mealsSection.style.display = "none";
    if (paymentsTabBtn) paymentsTabBtn.textContent = "Payments";
    renderStipendTimeline(data.data.stipend_history || []);
    if (feedbackCategory) feedbackCategory.value = "PAYMENT";
  } else {
    if (stipendSection) stipendSection.style.display = "none";
    if (mealsSection)   mealsSection.style.display = "block";
    if (paymentsTabBtn) paymentsTabBtn.textContent = "Meals";
    if (mealCardDisplay) mealCardDisplay.textContent = p.meal_card_number || "N/A";
    renderMealHistory(data.data.recent_meals || []);
    if (feedbackCategory) feedbackCategory.value = "FOOD";
  }

  await loadMyFeedback();
}

// ── Login ─────────────────────────────────────────────────────────────────────

studentLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(studentLoginForm);
  const payload  = Object.fromEntries(formData.entries());
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  try {
    const login = await fetchJSON("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (login.data.user.role !== "STUDENT") {
      authToken = "";
      studentLoginMessage.textContent = "This account is not a student account.";
      return;
    }
    authToken = login.data.token;
    showToast(`Welcome, ${login.data.user.username}!`, "success");
    loginView.style.display = "none";
    portalContent.style.display = "block";
    await refreshPortal();
  } catch (error) {
    showToast(error.message, "error");
    studentLoginMessage.textContent = error.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

studentLogoutBtn.addEventListener("click", () => {
  authToken = "";
  cachedProfile = null;
  loginView.style.display = "block";
  portalContent.style.display = "none";
  studentLoginForm.reset();
  studentLoginMessage.textContent = "";
  showToast("You have been logged out.", "info");
});

// ── Auto-fill username from URL (post-registration redirect) ──────────────────

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  const username = params.get("username");
  const usernameInput = studentLoginForm.querySelector('input[name="username"]');
  if (username && usernameInput) usernameInput.value = decodeURIComponent(username);
  studentLoginMessage.textContent = "Registration successful! Please sign in to view your account.";
  showToast("Registration complete — please sign in.", "success");
}
