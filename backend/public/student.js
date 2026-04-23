const studentLoginForm = document.getElementById("studentLoginForm");
const studentLoginMessage = document.getElementById("studentLoginMessage");
const profileBox = document.getElementById("profileBox");
const latestPaymentBox = document.getElementById("latestPaymentBox");
const stipendHistory = document.getElementById("stipendHistory");
const mealHistory = document.getElementById("mealHistory");
const studentLogoutBtn = document.getElementById("studentLogoutBtn");
const loginUsernameInput = studentLoginForm.querySelector('input[name="username"]');

let authToken = localStorage.getItem("student_token") || "";

async function fetchJSON(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, {
    headers,
    ...options,
  });
  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    await response.text();
    throw new Error("Server returned invalid response. Please restart backend and refresh.");
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function renderStipends(items) {
  if (!items.length) {
    stipendHistory.innerHTML = "<li>No stipend records.</li>";
    return;
  }
  stipendHistory.innerHTML = items
    .map(
      (s) => {
        const isPaid = s.status === "PAID";
        const confirmed = s.confirmed_at
          ? ` | Sent at: ${String(s.confirmed_at).replace("T", " ").slice(0, 16)}`
          : "";
        const sentNote = isPaid ? " | Payment sent by admin" : "";
        return `<li>Month: ${String(s.stipend_month).slice(0, 10)} | Amount: ${s.amount} | Status: ${
          s.status
        }${sentNote}${confirmed}</li>`;
      }
    )
    .join("");
}

function renderLatestPayment(items) {
  if (!items.length) {
    latestPaymentBox.textContent = "No stipend payment records found yet.";
    return;
  }

  const latest = items[0];
  const statusClass =
    latest.status === "PAID"
      ? "status-paid"
      : latest.status === "PENDING"
      ? "status-pending"
      : "status-failed";
  const sentInfo =
    latest.status === "PAID" && latest.confirmed_at
      ? `Payment was sent by admin on ${String(latest.confirmed_at).replace("T", " ").slice(0, 16)}.`
      : latest.status === "PENDING"
      ? "Payment is prepared and waiting for admin confirmation."
      : "Payment failed. Please contact finance/admin office.";

  latestPaymentBox.innerHTML = `
    Month: ${String(latest.stipend_month).slice(0, 10)} | Amount: ${latest.amount}
    <span class="status-badge ${statusClass}">${latest.status}</span>
    <div>${sentInfo}</div>
  `;
}

function renderMeals(items) {
  if (!items.length) {
    mealHistory.innerHTML = "<li>No meal logs.</li>";
    return;
  }
  mealHistory.innerHTML = items
    .map((m) => `<li>${String(m.date_time).replace("T", " ").slice(0, 16)} | ${m.meal_type}</li>`)
    .join("");
}

async function loadMyData() {
  const data = await fetchJSON("/api/students/me");
  const p = data.data.profile;
  profileBox.textContent = JSON.stringify(
    {
      student_id: p.student_id,
      full_name: `${p.first_name} ${p.last_name}`,
      department: p.dept_name,
      year_of_study: p.year_of_study,
      cafe_status: p.cafe_status,
      approved: p.is_approved,
      dorm: `${p.dorm_block}-${p.dorm_number} (Floor ${p.floor_number})`,
    },
    null,
    2
  );
  renderStipends(data.data.stipend_history);
  renderLatestPayment(data.data.stipend_history);
  renderMeals(data.data.recent_meals);
}

studentLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(studentLoginForm);
  const payload = Object.fromEntries(formData.entries());
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
    localStorage.setItem("student_token", authToken);
    studentLoginMessage.textContent = `Welcome ${login.data.user.username}`;
    await loadMyData();
  } catch (error) {
    studentLoginMessage.textContent = error.message;
  }
});

studentLogoutBtn.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("student_token");
  studentLoginMessage.textContent = "Logged out.";
  profileBox.textContent = "Login to view your profile.";
  latestPaymentBox.textContent = "Login to view your latest payment update.";
  stipendHistory.innerHTML = "<li>Login to view stipend records.</li>";
  mealHistory.innerHTML = "<li>Login to view meal logs.</li>";
});

if (authToken) {
  studentLoginMessage.textContent = "Session restored.";
  loadMyData().catch(() => {
    authToken = "";
    localStorage.removeItem("student_token");
    studentLoginMessage.textContent = "Saved session expired. Please login again.";
  });
}

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  const username = params.get("username");
  if (username && loginUsernameInput) {
    loginUsernameInput.value = username;
  }
  studentLoginMessage.textContent =
    "Registration successful. Please login to view your account and payment status.";
}
