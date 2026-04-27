const studentLoginForm = document.getElementById("studentLoginForm");
const studentLoginMessage = document.getElementById("studentLoginMessage");
const profileBox = document.getElementById("profileBox");
const studentLogoutBtn = document.getElementById("studentLogoutBtn");
const loginUsernameInput = studentLoginForm.querySelector('input[name="username"]');

const portalContent = document.getElementById("portalContent");
const approvalMessage = document.getElementById("approvalMessage");
const nonCafePaymentsCard = document.getElementById("nonCafePaymentsCard");
const paymentTracker = document.getElementById("paymentTracker");
const feedbackForm = document.getElementById("feedbackForm");
const feedbackMessage = document.getElementById("feedbackMessage");
const feedbackList = document.getElementById("feedbackList");
const feedbackCategory = document.getElementById("feedbackCategory");
const notificationList = document.getElementById("notificationList");

// Intentionally do NOT auto-restore sessions on shared PCs/labs.
// User must login explicitly each time.
let authToken = "";

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

async function postFormData(url, formData) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) data = await response.json();
  else {
    await response.text();
    throw new Error("Server returned invalid response. Please restart backend and refresh.");
  }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

function renderFeedback(items) {
  if (!feedbackList) return;
  if (!items.length) {
    feedbackList.innerHTML = "<li>No feedback submitted yet.</li>";
    return;
  }
  feedbackList.innerHTML = items
    .map((f) => {
      const badge =
        f.status === "RESOLVED"
          ? "status-paid"
          : f.status === "IN_REVIEW"
          ? "status-pending"
          : "status-failed";
      const photo = f.photo_path ? `<div style="margin-top:8px;"><a href="${f.photo_path}" target="_blank">View photo</a></div>` : "";
      const note = f.admin_note ? `<div style="margin-top:8px;color:rgba(255,255,255,0.8);">Admin note: ${f.admin_note}</div>` : "";
      return `<li>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <strong>${f.category}</strong>
          <span class="status-badge ${badge}">${f.status}</span>
        </div>
        <div style="margin-top:8px;">${f.message}</div>
        ${photo}
        ${note}
        <div style="margin-top:8px;color:rgba(255,255,255,0.6);font-size:0.85rem;">
          ${String(f.created_at).replace("T", " ").slice(0, 16)}
        </div>
      </li>`;
    })
    .join("");
}

async function loadMyFeedback() {
  if (!authToken) return;
  try {
    const data = await fetchJSON("/api/feedback/me");
    renderFeedback(data.data);
  } catch (e) {
    console.error(e);
  }
}

function renderNotifications(notifications) {
  if (!notificationList) return;
  if (!notifications.length) {
    notificationList.innerHTML = "<li>No notifications yet.</li>";
    return;
  }
  notificationList.innerHTML = notifications
    .map((n) => {
      const unreadClass = n.is_read ? "" : "font-weight: bold; background: rgba(255, 193, 7, 0.1);";
      return `<li style="${unreadClass}">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <strong>${n.title}</strong>
          ${!n.is_read ? '<span style="color: #ffc107;">●</span>' : ''}
        </div>
        <div style="margin-top:8px;">${n.message}</div>
        <div style="margin-top:8px;color:rgba(255,255,255,0.6);font-size:0.85rem;">
          ${String(n.created_at).replace("T", " ").slice(0, 16)}
        </div>
        ${!n.is_read ? '<button class="inline-btn" style="margin-top: 8px;" onclick="markAsRead(' + n.notification_id + ')">Mark as Read</button>' : ''}
      </li>`;
    })
    .join("");
}

async function loadNotifications() {
  if (!authToken) return;
  try {
    const data = await fetchJSON("/api/students/notifications");
    renderNotifications(data.data);
  } catch (e) {
    console.error(e);
  }
}

async function markAsRead(notificationId) {
  try {
    await fetchJSON(`/api/students/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
    await loadNotifications();
  } catch (error) {
    alert(error.message);
  }
}

function buildSepToJunMonths() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Academic year starts in September. If we're before Sep, academic year started last year.
  const startYear = month >= 9 ? year : year - 1;
  const months = [
    { y: startYear, m: 9, label: "September (Meskerem)" },
    { y: startYear, m: 10, label: "October (Tikimt)" },
    { y: startYear, m: 11, label: "November (Hidar)" },
    { y: startYear, m: 12, label: "December (Tahsas)" },
    { y: startYear + 1, m: 1, label: "January (Tir)" },
    { y: startYear + 1, m: 2, label: "February (Yekatit)" },
    { y: startYear + 1, m: 3, label: "March (Megabit)" },
    { y: startYear + 1, m: 4, label: "April (Miyazya)" },
    { y: startYear + 1, m: 5, label: "May (Ginbot)" },
    { y: startYear + 1, m: 6, label: "June (Sene)" },
  ];
  return months.map((x) => ({
    ...x,
    key: `${x.y}-${String(x.m).padStart(2, "0")}-01`,
  }));
}

function renderPaymentTracker(stipendHistoryItems) {
  if (!paymentTracker) return;
  const map = new Map(
    (stipendHistoryItems || []).map((s) => [String(s.stipend_month).slice(0, 10), s])
  );
  const months = buildSepToJunMonths();
  paymentTracker.innerHTML = `
    <ul>
      ${months
        .map((m) => {
          const rec = map.get(m.key);
          const status = rec ? rec.status : "NOT_PAID";
          const badge =
            status === "PAID"
              ? "status-paid"
              : status === "PENDING"
              ? "status-pending"
              : status === "FAILED"
              ? "status-failed"
              : "status-failed";
          const text =
            status === "NOT_PAID"
              ? "Not created yet"
              : status === "PENDING"
              ? "On the way (pending admin confirmation)"
              : status === "PAID"
              ? "Completed"
              : "Failed";
          const amount = rec ? rec.amount : "3000.00";
          return `<li>
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
              <strong>${m.label}</strong>
              <span class="status-badge ${badge}">${status}</span>
            </div>
            <div style="margin-top:8px;color:rgba(255,255,255,0.8);">Amount: ${amount} ETB</div>
            <div style="margin-top:6px;color:rgba(255,255,255,0.65);">${text}</div>
          </li>`;
        })
        .join("")}
    </ul>
  `;
}

async function loadMyData() {
  const data = await fetchJSON("/api/students/me");
  const p = data.data.profile;
  if (portalContent) portalContent.style.display = "block";

  profileBox.innerHTML = `
    <div class="profile-item">
      <strong>Student ID</strong>
      <div>${p.student_id}</div>
    </div>
    <div class="profile-item">
      <strong>Full Name</strong>
      <div>${p.first_name} ${p.last_name}</div>
    </div>
    <div class="profile-item">
      <strong>Department</strong>
      <div>${p.dept_name}</div>
    </div>
    <div class="profile-item">
      <strong>Year of Study</strong>
      <div>${p.year_of_study}</div>
    </div>
    <div class="profile-item">
      <strong>Cafe Status</strong>
      <div>${p.cafe_status}</div>
    </div>
    <div class="profile-item">
      <strong>Approved</strong>
      <div>${p.is_approved ? 'Yes' : 'No'}</div>
    </div>
    ${p.block_name && p.dorm_number ? `
    <div class="profile-item">
      <strong>Dorm</strong>
      <div>${p.block_name}-${p.dorm_number}</div>
    </div>
    ` : ''}
    ${p.meal_card_number ? `
    <div class="profile-item">
      <strong>Meal Card Number</strong>
      <div>${p.meal_card_number}</div>
    </div>
    ` : ''}
  `;

  if (approvalMessage) {
    if (!p.is_approved) {
      approvalMessage.textContent =
        "Your registration is still pending admin approval. Once approved, your portal will display your full profile and stipend status.";
      approvalMessage.style.color = "#f59e0b";
      studentLoginMessage.textContent = "Your account is pending approval. Please wait for admin confirmation.";
    } else {
      approvalMessage.textContent = "Your account is approved. Welcome to the student portal!";
      approvalMessage.style.color = "#10b981";
      studentLoginMessage.textContent = `Welcome back ${p.first_name}!`;
    }
  }

  if (feedbackCategory) {
    feedbackCategory.value = p.cafe_status === "CAFE" ? "FOOD" : "PAYMENT";
  }
  if (nonCafePaymentsCard) {
    nonCafePaymentsCard.style.display = p.cafe_status === "NON_CAFE" && p.is_approved ? "block" : "none";
  }

  if (p.cafe_status === "NON_CAFE" && p.is_approved) {
    renderPaymentTracker(data.data.stipend_history || []);
  }

  if (feedbackForm) {
    feedbackForm.style.display = p.is_approved ? "grid" : "none";
  }

  loadMyFeedback();
  loadNotifications();
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

if (feedbackForm) {
  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(feedbackForm);
    try {
      await postFormData("/api/feedback", formData);
      if (feedbackMessage) feedbackMessage.textContent = "Submitted successfully.";
      feedbackForm.reset();
      await loadMyFeedback();
    } catch (e) {
      if (feedbackMessage) feedbackMessage.textContent = e.message;
    }
  });
}

studentLogoutBtn.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("student_token");
  studentLoginMessage.textContent = "Logged out.";
  if (portalContent) portalContent.style.display = "none";
  profileBox.textContent = "Loading...";
  if (feedbackList) feedbackList.innerHTML = "<li>Loading...</li>";
  if (notificationList) notificationList.innerHTML = "<li>Loading notifications...</li>";
});

// No session restore by design.

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  const username = params.get("username");
  if (username && loginUsernameInput) {
    loginUsernameInput.value = username;
  }
  studentLoginMessage.textContent =
    "Registration successful. Please login to view your account and payment status.";
}

window.markAsRead = markAsRead;

