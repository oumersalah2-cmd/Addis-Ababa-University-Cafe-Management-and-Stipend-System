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

// ── API ───────────────────────────────────────────────────────────────────────

let authToken = localStorage.getItem("admin_token") || "";

async function fetchJSON(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, { headers, ...options });
  const ct = response.headers.get("content-type") || "";
  let data;
  if (ct.includes("application/json")) data = await response.json();
  else { await response.text(); throw new Error("Invalid server response. Please refresh."); }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const adminLoginView      = document.getElementById("adminLoginView");
const adminDashboardView  = document.getElementById("adminDashboardView");
const adminLoginForm      = document.getElementById("adminLoginForm");
const adminMessage        = document.getElementById("adminMessage");
const adminLoginBtn       = document.getElementById("adminLoginBtn");
const adminLogoutBtn      = document.getElementById("adminLogoutBtn");
const refreshAdminBtn     = document.getElementById("refreshAdminBtn");
const sidebarAvatar       = document.getElementById("sidebarAvatar");
const sidebarUsername     = document.getElementById("sidebarUsername");

// Sidebar badges
const pendingCountBadge   = document.getElementById("pendingCountBadge");
const stipendCountBadge   = document.getElementById("stipendCountBadge");
const feedbackCountBadge  = document.getElementById("feedbackCountBadge");

// ── Sidebar navigation ────────────────────────────────────────────────────────

window.switchSection = function (sectionId) {
  document.querySelectorAll(".admin-section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".sidebar-item").forEach((b) => b.classList.remove("active"));
  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add("active");
  const btn = document.querySelector(`.sidebar-item[data-section="${sectionId}"]`);
  if (btn) btn.classList.add("active");
};

document.querySelectorAll(".sidebar-item").forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

// ── Stats ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await fetchJSON("/api/admin/stats");
    const s = data.data;
    document.getElementById("stat-pending").textContent  = s.pending_students;
    document.getElementById("stat-stipends").textContent = s.pending_stipends;
    document.getElementById("stat-feedback").textContent = s.open_feedback;
    document.getElementById("stat-approved").textContent = s.total_approved;
    document.getElementById("stat-cafe").textContent     = s.cafe_students;
    document.getElementById("stat-noncafe").textContent  = s.non_cafe_students;

    // Sidebar badges
    if (pendingCountBadge) {
      pendingCountBadge.textContent = s.pending_students;
      pendingCountBadge.style.display = s.pending_students > 0 ? "inline" : "none";
    }
    if (stipendCountBadge) {
      stipendCountBadge.textContent = s.pending_stipends;
      stipendCountBadge.style.display = s.pending_stipends > 0 ? "inline" : "none";
    }
    if (feedbackCountBadge) {
      feedbackCountBadge.textContent = s.open_feedback;
      feedbackCountBadge.style.display = s.open_feedback > 0 ? "inline" : "none";
    }
  } catch (e) {
    console.error("[admin] stats error:", e.message);
  }
}

// ── Pending approvals ─────────────────────────────────────────────────────────

async function loadPendingStudents() {
  const list = document.getElementById("pendingStudentsList");
  if (!list) return;
  try {
    const data = await fetchJSON("/api/admin/students/pending");
    if (!data.data.length) {
      list.innerHTML = "<li style='color:var(--aau-text-muted);'>No students pending approval.</li>";
      return;
    }
    list.innerHTML = data.data.map((s) => {
      const reg = String(s.registered_at).slice(0, 10);
      return `<li>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;">${s.first_name} ${s.last_name}
              <span class="badge ${s.cafe_status === 'CAFE' ? 'badge-cafe' : 'badge-non-cafe'}" style="margin-left:0.5rem;">${s.cafe_status === 'CAFE' ? 'Cafe' : 'Non-Cafe'}</span>
            </div>
            <div style="color:var(--aau-text-muted);font-size:0.82rem;margin-top:0.2rem;">${s.student_id} &mdash; ${s.dept_name}</div>
            <div style="color:rgba(255,255,255,0.4);font-size:0.75rem;margin-top:0.15rem;">Registered: ${reg}</div>
          </div>
          <button class="inline-btn" onclick="approveStudent('${s.student_id}')">Approve</button>
        </div>
      </li>`;
    }).join("");
  } catch (e) {
    list.innerHTML = `<li style='color:var(--aau-error);'>${e.message}</li>`;
  }
}

// ── All students table ────────────────────────────────────────────────────────

async function loadAllStudents() {
  const search    = document.getElementById("studentSearch")?.value || "";
  const status    = document.getElementById("studentFilterStatus")?.value || "";
  const cafeType  = document.getElementById("studentFilterCafe")?.value || "";
  const tbody     = document.getElementById("allStudentsBody");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;color:var(--aau-text-muted);padding:2rem;'>Loading...</td></tr>";

  const params = new URLSearchParams();
  if (search)   params.set("search", search);
  if (status)   params.set("status", status);
  if (cafeType) params.set("cafe_status", cafeType);

  try {
    const data = await fetchJSON(`/api/admin/students/all?${params}`);
    if (!data.data.length) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;color:var(--aau-text-muted);padding:2rem;'>No students found.</td></tr>";
      return;
    }
    tbody.innerHTML = data.data.map((s) => {
      const dorm    = s.block_name ? `${s.block_name}-${s.dorm_number || "?"}` : "—";
      const apBadge = s.is_approved
        ? `<span class="badge badge-approved">Approved</span>`
        : `<span class="badge badge-pending">Pending</span>`;
      return `<tr>
        <td style="font-family:monospace;font-size:0.82rem;">${s.student_id}</td>
        <td>${s.first_name} ${s.last_name}</td>
        <td style="font-size:0.82rem;color:var(--aau-text-muted);">${s.dept_name}</td>
        <td style="text-align:center;">Yr ${s.year_of_study}</td>
        <td><span class="badge ${s.cafe_status === 'CAFE' ? 'badge-cafe' : 'badge-non-cafe'}">${s.cafe_status === 'CAFE' ? 'Cafe' : 'Non-Cafe'}</span></td>
        <td>${apBadge}</td>
        <td style="color:var(--aau-text-muted);font-size:0.82rem;">${dorm}</td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan='7' style='color:var(--aau-error);padding:1rem;'>${e.message}</td></tr>`;
  }
}

document.getElementById("searchStudentsBtn")?.addEventListener("click", loadAllStudents);
document.getElementById("studentSearch")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadAllStudents();
});

// ── Approve student ───────────────────────────────────────────────────────────

window.approveStudent = async function (studentId) {
  try {
    await fetchJSON(`/api/admin/students/${studentId}/approve`, { method: "PATCH" });
    showToast(`Student ${studentId} approved.`, "success");
    await refreshAllData();
  } catch (e) {
    showToast(e.message, "error");
  }
};

// ── Stipends ──────────────────────────────────────────────────────────────────

async function loadNonCafeStudentsSelect() {
  const sel = document.getElementById("stipendStudentSelect");
  if (!sel) return;
  try {
    const data = await fetchJSON("/api/admin/students/non-cafe-approved");
    if (!data.data.length) {
      sel.innerHTML = "<option value=''>No approved non-cafe students</option>";
      return;
    }
    sel.innerHTML = data.data
      .map((s) => `<option value="${s.student_id}">${s.student_id} — ${s.first_name} ${s.last_name}</option>`)
      .join("");
  } catch (e) {
    sel.innerHTML = `<option value=''>Error: ${e.message}</option>`;
  }
}

async function loadPendingStipends() {
  const list = document.getElementById("pendingStipendsList");
  if (!list) return;
  try {
    const data = await fetchJSON("/api/admin/stipends/pending");
    if (!data.data.length) {
      list.innerHTML = "<li style='color:var(--aau-text-muted);'>No pending stipend payments.</li>";
      return;
    }
    list.innerHTML = data.data.map((t) => {
      const month = String(t.stipend_month).slice(0, 10);
      return `<li>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;">${t.first_name} ${t.last_name}</div>
            <div style="color:var(--aau-text-muted);font-size:0.82rem;">${t.student_id}</div>
            <div style="margin-top:0.3rem;font-size:0.85rem;">
              Month: <strong>${month}</strong> &mdash;
              <strong style="color:var(--aau-accent);">${parseFloat(t.amount).toLocaleString()} ETB</strong>
            </div>
          </div>
          <button class="inline-btn" onclick="confirmStipend(${t.transaction_id})">Confirm Payment</button>
        </div>
      </li>`;
    }).join("");
  } catch (e) {
    list.innerHTML = `<li style='color:var(--aau-error);'>${e.message}</li>`;
  }
}

window.confirmStipend = async function (txId) {
  try {
    await fetchJSON(`/api/admin/stipends/${txId}/confirm`, { method: "PATCH", body: JSON.stringify({}) });
    showToast("Stipend payment confirmed.", "success");
    await refreshAllData();
  } catch (e) {
    showToast(e.message, "error");
  }
};

document.getElementById("stipendForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const msgEl = document.getElementById("stipendMessage");
  try {
    await fetchJSON("/api/admin/stipends", { method: "POST", body: JSON.stringify(payload) });
    showToast("Pending stipend created.", "success");
    if (msgEl) msgEl.textContent = "Pending stipend created successfully.";
    e.target.reset();
    await refreshAllData();
  } catch (err) {
    showToast(err.message, "error");
    if (msgEl) msgEl.textContent = err.message;
  }
});

// ── Menu ──────────────────────────────────────────────────────────────────────

async function loadMenu() {
  const list = document.getElementById("menuList");
  if (!list) return;
  try {
    const data = await fetchJSON("/api/menu");
    if (!data.data.length) {
      list.innerHTML = "<li style='color:var(--aau-text-muted);'>No menu items yet.</li>";
      return;
    }
    list.innerHTML = data.data.map((item) => `<li>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
        <div>
          <span style="font-weight:700;">${item.item_name}</span>
          <span class="badge" style="margin-left:0.4rem;background:rgba(255,255,255,0.05);color:var(--aau-text-muted);border:1px solid var(--glass-border);">${item.category}</span>
          <div style="color:var(--aau-text-muted);font-size:0.82rem;margin-top:0.2rem;">${item.description || ""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-shrink:0;">
          <span style="font-weight:700;color:var(--aau-accent);">${parseFloat(item.price).toLocaleString()} ETB</span>
          <button class="inline-btn" style="font-size:0.78rem;padding:0.35rem 0.8rem;${item.is_available ? 'background:rgba(239,68,68,0.1);color:#f87171;border-color:rgba(239,68,68,0.25);' : 'background:rgba(16,185,129,0.1);color:#10b981;border-color:rgba(16,185,129,0.25);'}"
            onclick="toggleMenuAvailability(${item.item_id}, ${!item.is_available})">
            ${item.is_available ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    </li>`).join("");
  } catch (e) {
    list.innerHTML = `<li style='color:var(--aau-error);'>${e.message}</li>`;
  }
}

window.toggleMenuAvailability = async function (itemId, status) {
  try {
    await fetchJSON(`/api/admin/menu/${itemId}`, { method: "PATCH", body: JSON.stringify({ is_available: status }) });
    showToast(`Item ${status ? "enabled" : "disabled"}.`, status ? "success" : "info");
    await loadMenu();
  } catch (e) {
    showToast(e.message, "error");
  }
};

document.getElementById("menuForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.price = Number(payload.price);
  try {
    await fetchJSON("/api/admin/menu", { method: "POST", body: JSON.stringify(payload) });
    showToast("Menu item added.", "success");
    e.target.reset();
    await loadMenu();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// ── Feedback ──────────────────────────────────────────────────────────────────

async function loadFeedbackAdmin() {
  const container = document.getElementById("feedbackAdminList");
  if (!container) return;
  try {
    const data = await fetchJSON("/api/admin/feedback/recent");
    if (!data.data.length) {
      container.innerHTML = "<p style='color:var(--aau-text-muted);'>No feedback submitted yet.</p>";
      return;
    }
    container.innerHTML = data.data.map((f) => {
      const badgeClass   = f.status === "RESOLVED" ? "status-paid" : f.status === "IN_REVIEW" ? "status-pending" : "status-failed";
      const cafeClass    = f.category === "FOOD" ? "badge-cafe" : "badge-non-cafe";
      const photoHtml    = f.photo_path
        ? `<div class="feedback-photo-preview"><img src="${f.photo_path}" alt="Feedback attachment" onclick="window.open('${f.photo_path}','_blank')" /></div>`
        : "";
      const adminNoteHtml = f.admin_note
        ? `<div style="margin-bottom:0.75rem;padding:0.75rem 1rem;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.85rem;"><strong>Current note:</strong> ${f.admin_note}</div>`
        : "";
      const dt = String(f.created_at).replace("T", " ").slice(0, 16);
      return `<div class="feedback-card">
        <div class="feedback-card-header">
          <div>
            <span class="badge ${cafeClass}">${f.category}</span>
            <span class="feedback-student-info" style="display:block;margin-top:0.4rem;">${f.student_id} &mdash; ${f.first_name} ${f.last_name} (${f.cafe_status})</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;">
            <span class="status-badge ${badgeClass}">${f.status}</span>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${dt}</span>
          </div>
        </div>
        <div class="feedback-message">${f.message}</div>
        ${photoHtml}
        ${adminNoteHtml}
        <div class="feedback-actions">
          <select id="fb_status_${f.feedback_id}" aria-label="Update status">
            <option value="OPEN" ${f.status === "OPEN" ? "selected" : ""}>Open</option>
            <option value="IN_REVIEW" ${f.status === "IN_REVIEW" ? "selected" : ""}>In Review</option>
            <option value="RESOLVED" ${f.status === "RESOLVED" ? "selected" : ""}>Resolved</option>
          </select>
          <input id="fb_note_${f.feedback_id}" placeholder="Add admin note..." value="${(f.admin_note || "").replace(/"/g, "&quot;")}" aria-label="Admin note" />
          <button class="feedback-save-btn" onclick="updateFeedback(${f.feedback_id})" type="button">Save</button>
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    container.innerHTML = `<p style='color:var(--aau-error);'>${e.message}</p>`;
  }
}

window.updateFeedback = async function (feedbackId) {
  const status     = document.getElementById(`fb_status_${feedbackId}`)?.value;
  const admin_note = document.getElementById(`fb_note_${feedbackId}`)?.value || "";
  try {
    await fetchJSON(`/api/admin/feedback/${feedbackId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, admin_note }),
    });
    showToast("Feedback updated.", "success");
    await loadFeedbackAdmin();
  } catch (e) {
    showToast(e.message, "error");
  }
};

// ── Monthly report ────────────────────────────────────────────────────────────

document.getElementById("monthlyReportForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const month = new FormData(e.target).get("month");
  const card  = document.getElementById("reportResultCard");
  const grid  = document.getElementById("reportStatsGrid");
  const label = document.getElementById("reportMonthLabel");
  try {
    const data = await fetchJSON(`/api/admin/reports/monthly?month=${encodeURIComponent(month)}`);
    if (!data.data) {
      showToast("No transactions found for this month.", "info");
      card.style.display = "none";
      return;
    }
    const r = data.data;
    if (label) label.textContent = `Report for ${String(r.stipend_month).slice(0, 7)}`;
    grid.innerHTML = [
      { label: "Total Transactions", value: r.total_transactions, cls: "" },
      { label: "Paid",               value: r.paid_count,         cls: "success" },
      { label: "Pending",            value: r.pending_count,      cls: "alert" },
      { label: "Failed",             value: r.failed_count,       cls: "alert" },
      { label: "Total Paid (ETB)",   value: parseFloat(r.paid_total || 0).toLocaleString(), cls: "success" },
    ].map((s) => `<div class="stat-card ${s.cls}"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join("");
    card.style.display = "block";
  } catch (err) {
    showToast(err.message, "error");
  }
});

// ── Audit log ─────────────────────────────────────────────────────────────────

async function loadAuditLog() {
  const container = document.getElementById("auditLogContainer");
  if (!container) return;
  try {
    const data = await fetchJSON("/api/admin/audit/recent");
    if (!data.data.length) {
      container.innerHTML = "<p style='color:var(--aau-text-muted);'>No admin actions logged yet.</p>";
      return;
    }
    container.innerHTML = data.data.map((l) => {
      const dt = String(l.created_at).replace("T", " ").slice(0, 19);
      return `<div class="audit-row">
        <div class="audit-action">${l.action_type}</div>
        <div class="audit-meta">
          <strong>${l.admin_username}</strong>
          ${l.target_student_id ? ` &rarr; Student: ${l.target_student_id}` : ""}
          ${l.target_transaction_id ? ` &rarr; Tx #${l.target_transaction_id}` : ""}
          ${l.details ? `<div style="margin-top:0.2rem;font-size:0.8rem;">${l.details}</div>` : ""}
        </div>
        <div class="audit-time">${dt}</div>
      </div>`;
    }).join("");
  } catch (e) {
    container.innerHTML = `<p style='color:var(--aau-error);'>${e.message}</p>`;
  }
}

// ── Refresh all ───────────────────────────────────────────────────────────────

async function refreshAllData() {
  if (!authToken) return;
  await Promise.all([
    loadStats(),
    loadPendingStudents(),
    loadNonCafeStudentsSelect(),
    loadPendingStipends(),
    loadMenu(),
    loadFeedbackAdmin(),
    loadAuditLog(),
  ]);
}

// ── Login / Logout ────────────────────────────────────────────────────────────

adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  adminLoginBtn.disabled   = true;
  adminLoginBtn.textContent = "Signing in...";
  try {
    const data = await fetchJSON("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    if (data.data.user.role !== "ADMIN") {
      authToken = "";
      adminMessage.textContent = "This account is not an admin account.";
      return;
    }
    authToken = data.data.token;
    localStorage.setItem("admin_token", authToken);
    localStorage.setItem("aau_token", authToken);

    const username = data.data.user.username;
    if (sidebarAvatar)   sidebarAvatar.textContent  = username.charAt(0).toUpperCase();
    if (sidebarUsername) sidebarUsername.textContent = username;

    adminLoginView.style.display     = "none";
    adminDashboardView.style.display = "block";
    showToast(`Welcome, ${username}!`, "success");
    await refreshAllData();
  } catch (err) {
    showToast(err.message, "error");
    adminMessage.textContent = err.message;
  } finally {
    adminLoginBtn.disabled   = false;
    adminLoginBtn.textContent = "Sign In as Admin";
  }
});

adminLogoutBtn?.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("admin_token");
  localStorage.removeItem("aau_token");
  adminDashboardView.style.display = "none";
  adminLoginView.style.display     = "block";
  adminLoginForm.reset();
  showToast("You have been logged out.", "info");
});

refreshAdminBtn?.addEventListener("click", async () => {
  refreshAdminBtn.disabled   = true;
  refreshAdminBtn.textContent = "Refreshing...";
  await refreshAllData();
  showToast("Data refreshed.", "success");
  refreshAdminBtn.disabled   = false;
  refreshAdminBtn.textContent = "Refresh Data";
});

// ── Session restore ───────────────────────────────────────────────────────────

if (authToken) {
  // Attempt to restore session
  fetchJSON("/api/admin/stats")
    .then(async (data) => {
      // Token valid — restore UI
      adminLoginView.style.display     = "none";
      adminDashboardView.style.display = "block";
      // Try to decode username from token (JWT payload is base64)
      try {
        const payload = JSON.parse(atob(authToken.split(".")[1]));
        if (sidebarAvatar)   sidebarAvatar.textContent  = (payload.username || "A").charAt(0).toUpperCase();
        if (sidebarUsername) sidebarUsername.textContent = payload.username || "Admin";
      } catch {}
      await refreshAllData();
    })
    .catch(() => {
      authToken = "";
      localStorage.removeItem("admin_token");
    });
}

window.approveStudent  = window.approveStudent;
window.confirmStipend  = window.confirmStipend;
window.toggleMenuAvailability = window.toggleMenuAvailability;
window.updateFeedback  = window.updateFeedback;
window.switchSection   = window.switchSection;
