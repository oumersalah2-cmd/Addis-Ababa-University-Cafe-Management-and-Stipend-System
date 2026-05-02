const adminLoginForm = document.getElementById("adminLoginForm");
const adminMessage = document.getElementById("adminMessage");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const pendingStudents = document.getElementById("pendingStudents");
const nonCafeStudents = document.getElementById("nonCafeStudents");
const paymentForm = document.getElementById("paymentForm");
const paymentMessage = document.getElementById("paymentMessage");
const pendingPayments = document.getElementById("pendingPayments");
const reportBox = document.getElementById("reportBox");
const loadReportBtn = document.getElementById("loadReportBtn");
const auditLogList = document.getElementById("auditLogList");
const statsRow = document.getElementById("statsRow");
const adminPanel = document.getElementById("adminPanel");

let authToken = localStorage.getItem("admin_token") || "";

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

function showMsg(el, text, isError = true) {
  el.textContent = text;
  el.className = "message " + (isError ? "msg-error" : "msg-success");
}

// Tab switching
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

async function loadPendingStudents() {
  const data = await fetchJSON("/api/admin/students/pending");
  document.getElementById("statPendingStudents").textContent = data.data.length;
  if (!data.data.length) { pendingStudents.innerHTML = "<li>No pending students.</li>"; return; }
  pendingStudents.innerHTML = data.data.map(s => `<li>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <strong>${s.first_name} ${s.last_name}</strong>
        <span style="color:var(--text-muted);margin-left:8px">${s.department_name || ""}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="status-badge status-pending">${s.student_type}</span>
        <button class="inline-btn" onclick="approveStudent(${s.student_id})">Approve</button>
      </div>
    </div>
    <div style="margin-top:6px;color:var(--text-muted);font-size:0.82rem">
      ${s.email} · Year ${s.year_of_study} · Enrolled ${s.year_enrolled}
    </div>
  </li>`).join("");
}

async function loadNonCafeStudents() {
  const data = await fetchJSON("/api/admin/students/non-cafe-approved");
  document.getElementById("statApproved").textContent = data.data.length;
  if (!data.data.length) { nonCafeStudents.innerHTML = "<option>No approved NON_CAFE students</option>"; return; }
  nonCafeStudents.innerHTML = data.data.map(s =>
    `<option value="${s.student_id}">${s.first_name} ${s.last_name} (${s.email})</option>`
  ).join("");
}

async function loadPendingPayments() {
  const data = await fetchJSON("/api/admin/payments/pending");
  document.getElementById("statPendingPayments").textContent = data.data.length;
  if (!data.data.length) { pendingPayments.innerHTML = "<li>No pending payments.</li>"; return; }
  pendingPayments.innerHTML = data.data.map(p => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `<li>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${p.first_name} ${p.last_name}</strong>
          <span style="color:var(--text-muted);margin-left:8px">${months[p.payment_month-1]} ${p.payment_year}</span>
          <span style="color:var(--text-muted);margin-left:8px">${p.amount} ETB</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="inline-btn" onclick="confirmPayment(${p.payment_id})">Confirm</button>
          <button class="inline-btn" onclick="markSent(${p.payment_id})">Mark Sent</button>
        </div>
      </div>
    </li>`;
  }).join("");
}

async function loadAuditLog() {
  const data = await fetchJSON("/api/admin/audit/recent");
  if (!data.data.length) { auditLogList.innerHTML = "<li>No audit entries yet.</li>"; return; }
  auditLogList.innerHTML = data.data.map(l => `<li>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <strong>${l.action} → ${l.target_table}</strong>
      <span style="color:var(--text-muted);font-size:0.8rem">${String(l.logged_at).replace("T"," ").slice(0,19)}</span>
    </div>
    <div style="margin-top:6px;color:var(--text-muted);font-size:0.85rem">${l.new_value || l.old_value || "—"}</div>
  </li>`).join("");
}

async function loadReport() {
  const data = await fetchJSON("/api/admin/reports/department-summary");
  if (!data.data || !data.data.length) { reportBox.textContent = "No payment data found."; return; }
  reportBox.textContent = JSON.stringify(data.data, null, 2);
}

async function approveStudent(id) {
  try {
    await fetchJSON(`/api/admin/students/${id}/approve`, { method: "PATCH" });
    await refreshAll();
  } catch (e) { alert(e.message); }
}

async function confirmPayment(id) {
  try {
    await fetchJSON(`/api/admin/payments/${id}/confirm`, { method: "PATCH" });
    await refreshAll();
  } catch (e) { alert(e.message); }
}

async function markSent(id) {
  try {
    await fetchJSON(`/api/admin/payments/${id}/send`, { method: "PATCH" });
    await refreshAll();
  } catch (e) { alert(e.message); }
}

async function refreshAll() {
  if (!authToken) return;
  await Promise.all([loadPendingStudents(), loadNonCafeStudents(), loadPendingPayments(), loadAuditLog()]);
  // Sent payments stat
  try {
    const d = await fetchJSON("/api/admin/payments/sent-count");
    document.getElementById("statSentPayments").textContent = d.data.count;
  } catch(_){}
}

// Login
adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(adminLoginForm);
  const payload = Object.fromEntries(fd.entries());
  try {
    const data = await fetchJSON("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...payload, role: "admin" }),
    });
    authToken = data.data.token;
    localStorage.setItem("admin_token", authToken);
    showMsg(adminMessage, `Logged in as ${data.data.user.full_name}`, false);
    statsRow.style.display = "grid";
    adminPanel.style.display = "block";
    await refreshAll();
  } catch (error) {
    showMsg(adminMessage, error.message);
  }
});

// Logout
adminLogoutBtn.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("admin_token");
  showMsg(adminMessage, "Logged out.", false);
  statsRow.style.display = "none";
  adminPanel.style.display = "none";
});

loadReportBtn.addEventListener("click", () => loadReport().catch(e => { reportBox.textContent = e.message; }));

window.approveStudent = approveStudent;
window.confirmPayment = confirmPayment;
window.markSent = markSent;

// Auto-restore session
if (authToken) {
  statsRow.style.display = "grid";
  adminPanel.style.display = "block";
  showMsg(adminMessage, "Session restored.", false);
  refreshAll().catch(() => {
    authToken = "";
    localStorage.removeItem("admin_token");
    showMsg(adminMessage, "Session expired. Please login again.");
    statsRow.style.display = "none";
    adminPanel.style.display = "none";
  });
}
