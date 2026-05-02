const deptSelect = document.getElementById("deptSelect");
const dormSelect = document.getElementById("dormSelect");
const studentType = document.getElementById("studentType");
const studentForm = document.getElementById("studentForm");
const studentMessage = document.getElementById("studentMessage");
const registerBtn = document.getElementById("registerBtn");
const pwStrength = document.getElementById("pwStrength");
const passwordInput = studentForm.querySelector('input[name="password"]');

const API = window.location.origin;

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const ct = response.headers.get("content-type") || "";
  let data;
  if (ct.includes("application/json")) {
    data = await response.json();
  } else {
    await response.text();
    throw new Error("Server returned non-JSON response. Please check backend.");
  }
  if (!response.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showMessage(text, isError = true) {
  studentMessage.textContent = text;
  studentMessage.className = "message " + (isError ? "msg-error" : "msg-success");
}

// Password strength
function checkPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  pwStrength.className = "pw-strength";
  if (score >= 4) pwStrength.classList.add("pw-strong");
  else if (score >= 3) pwStrength.classList.add("pw-medium");
  else if (score >= 1) pwStrength.classList.add("pw-weak");
}

passwordInput.addEventListener("input", () => checkPasswordStrength(passwordInput.value));

// Load departments
async function loadDepartments() {
  try {
    const data = await fetchJSON("/api/departments");
    deptSelect.innerHTML = data.data
      .map(d => `<option value="${d.department_id}">${d.department_name}</option>`)
      .join("");
  } catch (_e) {
    showMessage("Could not load departments.");
  }
}

// Load dormitories
async function loadDormitories() {
  try {
    const data = await fetchJSON("/api/dormitories");
    dormSelect.innerHTML = data.data
      .map(d => `<option value="${d.dormitory_id}">${d.dorm_name} (Block ${d.block})</option>`)
      .join("");
  } catch (_e) {
    showMessage("Could not load dormitories.");
  }
}

// Submit
studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(studentForm);
  const payload = Object.fromEntries(fd.entries());
  payload.year_of_study = Number(payload.year_of_study);
  payload.year_enrolled = Number(payload.year_enrolled);
  payload.department_id = Number(payload.department_id);
  payload.dormitory_id = Number(payload.dormitory_id);

  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(payload.password || "");
  if (!strong) {
    showMessage("Password must be 8+ chars with uppercase, lowercase, and a number.");
    return;
  }

  registerBtn.classList.add("btn-loading");
  registerBtn.disabled = true;

  try {
    await fetchJSON("/api/students/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showMessage("Registration successful! Redirecting to login…", false);
    setTimeout(() => {
      const email = encodeURIComponent(payload.email || "");
      window.location.href = `/student?registered=1&email=${email}`;
    }, 1200);
  } catch (error) {
    showMessage(error.message);
  } finally {
    registerBtn.classList.remove("btn-loading");
    registerBtn.disabled = false;
  }
});

// Boot
Promise.all([loadDepartments(), loadDormitories()]);
