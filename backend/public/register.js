const deptSelect = document.getElementById("deptSelect");
const cafeStatus = document.getElementById("cafeStatus");
const bankAccount = document.getElementById("bankAccount");
const studentForm = document.getElementById("studentForm");
const studentMessage = document.getElementById("studentMessage");
const fallbackDepartments = [
  { dept_id: 1, dept_name: "Civil Engineering" },
  { dept_id: 2, dept_name: "Software Engineering" },
  { dept_id: 3, dept_name: "Electrical and Computer Engineering" },
  { dept_id: 4, dept_name: "Mechanical Engineering" },
  { dept_id: 5, dept_name: "Biomedical Engineering" },
  { dept_id: 6, dept_name: "Chemical Engineering" },
];

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
    throw new Error(
      `Server returned non-JSON response for ${url}. Please restart backend server and refresh page.`
    );
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function toggleBankAccountRequirement() {
  const isNonCafe = cafeStatus.value === "NON_CAFE";
  bankAccount.required = isNonCafe;
  bankAccount.placeholder = isNonCafe
    ? "Required for NON_CAFE students"
    : "Optional (ignored for CAFE students)";
}

async function loadDepartments() {
  try {
    const data = await fetchJSON("/api/departments");
    const departments = Array.isArray(data.data) && data.data.length ? data.data : fallbackDepartments;
    deptSelect.innerHTML = departments
      .map((dept) => `<option value="${dept.dept_id}">${dept.dept_name}</option>`)
      .join("");
    if (!Array.isArray(data.data) || data.data.length === 0) {
      studentMessage.textContent = "Using default department list. Ask admin to run database seed.";
    }
  } catch (_error) {
    deptSelect.innerHTML = fallbackDepartments
      .map((dept) => `<option value="${dept.dept_id}">${dept.dept_name}</option>`)
      .join("");
    studentMessage.textContent =
      "Department service is unavailable now. Using default department list.";
  }
}

studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(studentForm);
  const payload = Object.fromEntries(formData.entries());
  payload.year_of_study = Number(payload.year_of_study);
  payload.dept_id = Number(payload.dept_id);
  payload.floor_number = Number(payload.floor_number);
  if (payload.cafe_status === "CAFE") {
    payload.bank_account_number = "";
  }
  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(payload.password || "");
  if (!strong) {
    studentMessage.textContent =
      "Password must be 8+ chars and include uppercase, lowercase, and number.";
    return;
  }

  try {
    await fetchJSON("/api/students/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    studentMessage.textContent = "Registration completed. Redirecting to student login...";
    setTimeout(() => {
      const username = encodeURIComponent(payload.username || "");
      window.location.href = `/student?registered=1&username=${username}`;
    }, 900);
  } catch (error) {
    studentMessage.textContent = error.message;
  }
});

cafeStatus.addEventListener("change", toggleBankAccountRequirement);

async function boot() {
  toggleBankAccountRequirement();
  await loadDepartments();
}

boot();
