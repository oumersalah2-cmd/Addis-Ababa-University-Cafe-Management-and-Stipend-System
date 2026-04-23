const pendingStudents = document.getElementById("pendingStudents");
const refreshAdmin = document.getElementById("refreshAdmin");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminMessage = document.getElementById("adminMessage");
const nonCafeStudents = document.getElementById("nonCafeStudents");
const stipendForm = document.getElementById("stipendForm");
const stipendMessage = document.getElementById("stipendMessage");
const pendingStipends = document.getElementById("pendingStipends");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const monthlyReportForm = document.getElementById("monthlyReportForm");
const monthlyReportBox = document.getElementById("monthlyReportBox");
const auditLogList = document.getElementById("auditLogList");

let authToken = localStorage.getItem("admin_token") || "";

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

async function loadPendingStudents() {
  const data = await fetchJSON("/api/admin/students/pending");
  if (data.data.length === 0) {
    pendingStudents.innerHTML = "<li>No pending students.</li>";
    return;
  }
  pendingStudents.innerHTML = data.data
    .map(
      (s) => `<li>
        <strong>${s.student_id}</strong> - ${s.first_name} ${s.last_name} (${s.dept_name})
        <br />
        <button class="inline-btn" onclick="approveStudent('${s.student_id}')">Approve</button>
      </li>`
    )
    .join("");
}

async function loadNonCafeApprovedStudents() {
  const data = await fetchJSON("/api/admin/students/non-cafe-approved");
  if (data.data.length === 0) {
    nonCafeStudents.innerHTML = "<option value=''>No approved non-cafe students</option>";
    return;
  }
  nonCafeStudents.innerHTML = data.data
    .map(
      (s) =>
        `<option value="${s.student_id}">${s.student_id} - ${s.first_name} ${s.last_name}</option>`
    )
    .join("");
}

async function loadPendingStipends() {
  const data = await fetchJSON("/api/admin/stipends/pending");
  if (data.data.length === 0) {
    pendingStipends.innerHTML = "<li>No pending stipend payments.</li>";
    return;
  }
  pendingStipends.innerHTML = data.data
    .map(
      (t) => `<li>
        <strong>#${t.transaction_id}</strong> - ${t.student_id} (${t.first_name} ${t.last_name})
        <br />Month: ${String(t.stipend_month).slice(0, 10)} | Amount: ${t.amount}
        <br />
        <button class="inline-btn" onclick="confirmStipend(${t.transaction_id})">Confirm Payment</button>
      </li>`
    )
    .join("");
}

async function approveStudent(studentId) {
  try {
    await fetchJSON(`/api/admin/students/${studentId}/approve`, { method: "PATCH" });
    await refreshAdminData();
  } catch (error) {
    alert(error.message);
  }
}

async function confirmStipend(transactionId) {
  try {
    await fetchJSON(`/api/admin/stipends/${transactionId}/confirm`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    await refreshAdminData();
  } catch (error) {
    alert(error.message);
  }
}

async function refreshAdminData() {
  if (!authToken) return;
  await Promise.all([
    loadPendingStudents(),
    loadNonCafeApprovedStudents(),
    loadPendingStipends(),
    loadAuditLog(),
  ]);
}

async function loadMonthlyReport(month) {
  const data = await fetchJSON(`/api/admin/reports/monthly?month=${encodeURIComponent(month)}`);
  if (!data.data) {
    monthlyReportBox.textContent = "No transactions found for this month.";
    return;
  }
  monthlyReportBox.textContent = JSON.stringify(data.data, null, 2);
}

async function loadAuditLog() {
  const data = await fetchJSON("/api/admin/audit/recent");
  if (!data.data.length) {
    auditLogList.innerHTML = "<li>No admin actions logged yet.</li>";
    return;
  }
  auditLogList.innerHTML = data.data
    .map(
      (l) => `<li>
        <strong>${l.action_type}</strong> by ${l.admin_username}
        <br />Student: ${l.target_student_id || "-"} | Tx: ${l.target_transaction_id || "-"}
        <br />${l.details || ""}
        <br /><small>${String(l.created_at).replace("T", " ").slice(0, 19)}</small>
      </li>`
    )
    .join("");
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(adminLoginForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const data = await fetchJSON("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data.data.user.role !== "ADMIN") {
      authToken = "";
      adminMessage.textContent = "This account is not an admin account.";
      return;
    }
    authToken = data.data.token;
    localStorage.setItem("admin_token", authToken);
    adminMessage.textContent = `Logged in as ${data.data.user.username}`;
    await refreshAdminData();
  } catch (error) {
    adminMessage.textContent = error.message;
  }
});

monthlyReportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(monthlyReportForm);
  const month = formData.get("month");
  try {
    await loadMonthlyReport(month);
  } catch (error) {
    monthlyReportBox.textContent = error.message;
  }
});

stipendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(stipendForm);
  const payload = Object.fromEntries(formData.entries());
  payload.amount = Number(payload.amount);

  try {
    await fetchJSON("/api/admin/stipends", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    stipendMessage.textContent = "Pending stipend created.";
    stipendForm.reset();
    await refreshAdminData();
  } catch (error) {
    stipendMessage.textContent = error.message;
  }
});

refreshAdmin.addEventListener("click", refreshAdminData);
adminLogoutBtn.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("admin_token");
  adminMessage.textContent = "Logged out.";
  pendingStudents.innerHTML = "<li>Login as admin to load data.</li>";
  pendingStipends.innerHTML = "<li>Login as admin to load data.</li>";
  monthlyReportBox.textContent = "Login and choose month to view report.";
  auditLogList.innerHTML = "<li>Login as admin to load activity log.</li>";
});

window.approveStudent = approveStudent;
window.confirmStipend = confirmStipend;

if (authToken) {
  adminMessage.textContent = "Session restored.";
  refreshAdminData().catch(() => {
    authToken = "";
    localStorage.removeItem("admin_token");
    adminMessage.textContent = "Saved session expired. Please login again.";
  });
}
