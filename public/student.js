const studentLoginForm = document.getElementById("studentLoginForm");
const studentLoginMessage = document.getElementById("studentLoginMessage");
const profileBox = document.getElementById("profileBox");
const studentLogoutBtn = document.getElementById("studentLogoutBtn");
const portalContent = document.getElementById("portalContent");
const approvalMessage = document.getElementById("approvalMessage");
const paymentCard = document.getElementById("paymentCard");
const paymentTracker = document.getElementById("paymentTracker");
const mealCard = document.getElementById("mealCard");
const mealList = document.getElementById("mealList");
const loginEmailInput = studentLoginForm.querySelector('input[name="email"]');

let authToken = "";

async function fetchJSON(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, { headers, ...options });
  const ct = response.headers.get("content-type") || "";
  let data;
  if (ct.includes("application/json")) data = await response.json();
  else { await response.text(); throw new Error("Server returned invalid response."); }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showMsg(text, isError = true) {
  studentLoginMessage.textContent = text;
  studentLoginMessage.className = "message " + (isError ? "msg-error" : "msg-success");
}

function renderPayments(payments) {
  if (!payments || !payments.length) {
    paymentTracker.innerHTML = `<p style="color:var(--text-muted)">No payment records yet.</p>`;
    return;
  }
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  paymentTracker.innerHTML = `<ul>${payments.map(p => {
    const statusClass = p.status === "SENT" ? "status-sent" : p.status === "CONFIRMED" ? "status-confirmed" : "status-pending";
    const label = p.status === "SENT" ? "Sent ✓" : p.status === "CONFIRMED" ? "Confirmed" : "Pending";
    return `<li class="payment-month">
      <div>
        <span class="pm-label">${months[p.payment_month - 1]} ${p.payment_year}</span>
        <span class="pm-amount" style="margin-left:12px">${p.amount} ETB</span>
      </div>
      <span class="status-badge ${statusClass}">${label}</span>
    </li>`;
  }).join("")}</ul>`;
}

function renderMeals(meals) {
  if (!meals || !meals.length) {
    mealList.innerHTML = "<li>No meal attendance records yet.</li>";
    return;
  }
  mealList.innerHTML = meals.map(m => {
    const date = String(m.meal_date).slice(0, 10);
    return `<li style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${m.meal_type}</strong> — ${m.item_name || "Meal"}</div>
      <span style="color:var(--text-muted);font-size:0.85rem">${date}</span>
    </li>`;
  }).join("");
}

async function loadMyData() {
  const data = await fetchJSON("/api/students/me");
  const p = data.data.profile;
  portalContent.style.display = "block";

  profileBox.innerHTML = `
    <div class="profile-item"><strong>Student ID</strong><div>#${p.student_id}</div></div>
    <div class="profile-item"><strong>Full Name</strong><div>${p.first_name} ${p.last_name}</div></div>
    <div class="profile-item"><strong>Email</strong><div>${p.email}</div></div>
    <div class="profile-item"><strong>Department</strong><div>${p.department_name || "—"}</div></div>
    <div class="profile-item"><strong>Year of Study</strong><div>${p.year_of_study}</div></div>
    <div class="profile-item"><strong>Year Enrolled</strong><div>${p.year_enrolled}</div></div>
    <div class="profile-item"><strong>Student Type</strong><div>${p.student_type}</div></div>
    <div class="profile-item"><strong>Gender</strong><div>${p.gender || "—"}</div></div>
    <div class="profile-item"><strong>Dormitory</strong><div>${p.dorm_name ? p.dorm_name + " (Block " + p.block + ")" : "—"}</div></div>
    <div class="profile-item"><strong>Approved</strong><div>${p.is_approved ? "✅ Yes" : "⏳ Pending"}</div></div>
  `;

  if (!p.is_approved) {
    approvalMessage.textContent = "Your registration is pending admin approval. Please check back later.";
    approvalMessage.style.color = "var(--warning)";
    showMsg("Account pending approval. Some features are restricted.", true);
  } else {
    approvalMessage.textContent = "Your account is approved! Welcome to the student portal.";
    approvalMessage.style.color = "var(--success)";
    showMsg("Welcome back, " + p.first_name + "!", false);
  }

  // Show payment tracker for NON_CAFE
  if (p.student_type === "NON_CAFE") {
    paymentCard.style.display = "block";
    mealCard.style.display = "none";
    renderPayments(data.data.payments || []);
  }

  // Show meal history for CAFE
  if (p.student_type === "CAFE") {
    mealCard.style.display = "block";
    paymentCard.style.display = "none";
    renderMeals(data.data.meals || []);
  }
}

// Login
studentLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(studentLoginForm);
  const payload = Object.fromEntries(fd.entries());
  try {
    const data = await fetchJSON("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...payload, role: "student" }),
    });
    authToken = data.data.token;
    await loadMyData();
  } catch (error) {
    showMsg(error.message);
  }
});

// Logout
studentLogoutBtn.addEventListener("click", () => {
  authToken = "";
  showMsg("Logged out.", false);
  portalContent.style.display = "none";
  profileBox.textContent = "Loading…";
});

// Handle redirect from registration
const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  const email = params.get("email");
  if (email && loginEmailInput) loginEmailInput.value = email;
  showMsg("Registration successful! Please log in.", false);
}
