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
const menuForm = document.getElementById("menuForm");
const menuList = document.getElementById("menuList");
const feedbackAdminList = document.getElementById("feedbackAdminList");

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

async function loadMenu() {
  const data = await fetchJSON("/api/menu");
  if (data.data.length === 0) {
    menuList.innerHTML = "<li>No menu items added.</li>";
    return;
  }
  menuList.innerHTML = data.data
    .map(
      (item) => `<li style="margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
        <strong>${item.item_name}</strong> (${item.category}) - ${item.price} ETB
        <br/><small>${item.description || ""}</small>
        <br/><button class="inline-btn" style="background: #f44336; margin-top: 5px;" onclick="toggleAvailability(${item.item_id}, ${!item.is_available})">${item.is_available ? 'Disable' : 'Enable'}</button>
      </li>`
    )
    .join("");
}

async function toggleAvailability(itemId, status) {
  try {
    await fetchJSON(`/api/admin/menu/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_available: status }),
    });
    await loadMenu();
  } catch (error) {
    alert(error.message);
  }
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
    loadMenu(),
    loadPendingStudents(),
    loadNonCafeApprovedStudents(),
    loadPendingStipends(),
    loadAuditLog(),
    loadFeedbackAdmin(),
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

async function loadFeedbackAdmin() {
  if (!feedbackAdminList) return;
  const data = await fetchJSON("/api/admin/feedback/recent");
  if (!data.data.length) {
    feedbackAdminList.innerHTML = "<li>No feedback submitted yet.</li>";
    return;
  }
  feedbackAdminList.innerHTML = data.data
    .map((f) => {
      const photo = f.photo_path ? `<a href="${f.photo_path}" target="_blank">photo</a>` : "no photo";
      return `<li>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <strong>${f.category}</strong>
          <span class="status-badge ${f.status === "RESOLVED" ? "status-paid" : f.status === "IN_REVIEW" ? "status-pending" : "status-failed"}">${f.status}</span>
        </div>
        <div style="margin-top:6px;color:rgba(255,255,255,0.8);">
          ${f.student_id} - ${f.first_name} ${f.last_name} (${f.cafe_status})
        </div>
        <div style="margin-top:10px;">${f.message}</div>
        <div style="margin-top:8px;">Attachment: ${photo}</div>
        <div style="margin-top:8px;color:rgba(255,255,255,0.75);">Admin note: ${f.admin_note || "-"}</div>
        <div class="form-grid" style="margin-top:12px;">
          <label>Status
            <select id="fb_status_${f.feedback_id}">
              <option value="OPEN" ${f.status === "OPEN" ? "selected" : ""}>OPEN</option>
              <option value="IN_REVIEW" ${f.status === "IN_REVIEW" ? "selected" : ""}>IN_REVIEW</option>
              <option value="RESOLVED" ${f.status === "RESOLVED" ? "selected" : ""}>RESOLVED</option>
            </select>
          </label>
          <label>Note
            <input id="fb_note_${f.feedback_id}" value="${(f.admin_note || "").replace(/"/g, "&quot;")}" />
          </label>
          <button class="full" type="button" onclick="updateFeedback(${f.feedback_id})">Save</button>
        </div>
      </li>`;
    })
    .join("");
}

async function updateFeedback(feedbackId) {
  try {
    const status = document.getElementById(`fb_status_${feedbackId}`)?.value;
    const admin_note = document.getElementById(`fb_note_${feedbackId}`)?.value || "";
    await fetchJSON(`/api/admin/feedback/${feedbackId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, admin_note }),
    });
    await loadFeedbackAdmin();
  } catch (e) {
    alert(e.message);
  }
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
    localStorage.setItem("aau_token", authToken); // For kitchen
    adminMessage.textContent = `Logged in as ${data.data.user.username}`;
    await refreshAdminData();
  } catch (error) {
    adminMessage.textContent = error.message;
  }
});

menuForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(menuForm);
  const payload = Object.fromEntries(formData.entries());
  payload.price = Number(payload.price);
  try {
    await fetchJSON("/api/admin/menu", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    menuForm.reset();
    await loadMenu();
  } catch (error) {
    alert(error.message);
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
  localStorage.removeItem("aau_token");
  adminMessage.textContent = "Logged out.";
  menuList.innerHTML = "<li>Login as admin to load data.</li>";
  pendingStudents.innerHTML = "<li>Login as admin to load data.</li>";
  pendingStipends.innerHTML = "<li>Login as admin to load data.</li>";
  monthlyReportBox.textContent = "Login and choose month to view report.";
  auditLogList.innerHTML = "<li>Login as admin to load activity log.</li>";
});

window.approveStudent = approveStudent;
window.confirmStipend = confirmStipend;
window.toggleAvailability = toggleAvailability;
window.updateFeedback = updateFeedback;

if (authToken) {
  adminMessage.textContent = "Session restored.";
  refreshAdminData().catch(() => {
    authToken = "";
    localStorage.removeItem("admin_token");
    adminMessage.textContent = "Saved session expired. Please login again.";
  });
}

