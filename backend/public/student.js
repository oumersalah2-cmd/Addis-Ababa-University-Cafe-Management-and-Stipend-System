const studentLoginForm = document.getElementById("studentLoginForm");
const studentLoginMessage = document.getElementById("studentLoginMessage");
const profileBox = document.getElementById("profileBox");
const latestPaymentBox = document.getElementById("latestPaymentBox");
const stipendHistory = document.getElementById("stipendHistory");
const mealHistory = document.getElementById("mealHistory");
const studentLogoutBtn = document.getElementById("studentLogoutBtn");
const loginUsernameInput = studentLoginForm.querySelector('input[name="username"]');

const menuContainer = document.getElementById("menuContainer");
const cartBox = document.getElementById("cartBox");
const cartItemsList = document.getElementById("cartItems");
const cartTotalSpan = document.getElementById("cartTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderMessage = document.getElementById("orderMessage");
const activeOrdersBox = document.getElementById("activeOrdersBox");
const mealLoggerCard = document.getElementById("mealLoggerCard");
const mealLogForm = document.getElementById("mealLogForm");
const mealLogMessage = document.getElementById("mealLogMessage");

let authToken = localStorage.getItem("student_token") || "";
let cart = [];
let menu = [];

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
  try {
    const data = await fetchJSON("/api/menu");
    menu = data.data;
    if (menu.length === 0) {
      menuContainer.innerHTML = "<p>No items available today.</p>";
      return;
    }
    menuContainer.innerHTML = menu.map(item => `
      <div class="menu-item-card" style="border: 1px solid #ddd; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
        <div style="font-weight: bold;">${item.item_name}</div>
        <div style="font-size: 0.8rem; color: #666;">${item.category}</div>
        <div style="font-size: 0.9rem; margin: 5px 0;">${item.description || ''}</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; color: #2e7d32;">${item.price} ETB</span>
          <button class="inline-btn" onclick="addToCart(${item.item_id})">Add</button>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

function addToCart(itemId) {
  const item = menu.find(i => i.item_id === itemId);
  const existing = cart.find(c => c.item_id === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  renderCart();
}

function renderCart() {
  if (cart.length === 0) {
    cartBox.style.display = "none";
    return;
  }
  cartBox.style.display = "block";
  cartItemsList.innerHTML = cart.map(item => `
    <li style="display: flex; justify-content: space-between; margin-bottom: 5px;">
      <span>${item.item_name} x${item.quantity}</span>
      <span>${(item.price * item.quantity).toFixed(2)} ETB</span>
    </li>
  `).join('');
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartTotalSpan.textContent = total.toFixed(2);
}

async function placeOrder() {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const is_cafe_meal = total === 0;
  try {
    const res = await fetchJSON("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
        total_amount: total,
        is_cafe_meal
      })
    });
    orderMessage.textContent = "Order placed successfully!";
    cart = [];
    renderCart();
    loadActiveOrders();
  } catch (e) {
    orderMessage.textContent = e.message;
  }
}

async function loadActiveOrders() {
  try {
    const data = await fetchJSON("/api/orders/me");
    const active = data.data.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (active.length === 0) {
      activeOrdersBox.innerHTML = "<p>No active orders.</p>";
      return;
    }
    activeOrdersBox.innerHTML = active.map(o => `
      <div style="border: 1px solid #2196f3; padding: 10px; border-radius: 8px; margin-bottom: 10px; background: #e3f2fd;">
        <div style="display: flex; justify-content: space-between;">
          <strong>Order #${o.order_id}</strong>
          <span class="status-badge" style="background: #2196f3; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${o.status}</span>
        </div>
        <div style="font-size: 0.8rem; margin: 5px 0;">
          ${o.items.map(i => `${i.item_name} x${i.quantity}`).join(', ')}
        </div>
        <div style="font-size: 0.75rem; color: #666;">Placed at: ${new Date(o.order_time).toLocaleTimeString()}</div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
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
      dorm: `${p.block_name} Room ${p.room_number} (Floor ${p.floor_number})`,
    },
    null,
    2
  );

  if (mealLoggerCard) {
    mealLoggerCard.style.display = p.cafe_status === "CAFE" ? "block" : "none";
    if (mealLogMessage) mealLogMessage.textContent = "";
  }

  renderStipends(data.data.stipend_history);
  renderLatestPayment(data.data.stipend_history);
  renderMeals(data.data.recent_meals);
  loadMenu();
  loadActiveOrders();
}

async function logMeal(event) {
  event.preventDefault();
  if (!mealLogForm) return;
  const formData = new FormData(mealLogForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await fetchJSON("/api/meals/log", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (mealLogMessage) mealLogMessage.textContent = "Meal logged successfully.";
    await loadMyData();
  } catch (e) {
    if (mealLogMessage) mealLogMessage.textContent = e.message;
  }
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

placeOrderBtn.onclick = placeOrder;
if (mealLogForm) mealLogForm.addEventListener("submit", logMeal);

studentLogoutBtn.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("student_token");
  studentLoginMessage.textContent = "Logged out.";
  profileBox.textContent = "Login to view your profile.";
  latestPaymentBox.textContent = "Login to view your latest payment update.";
  stipendHistory.innerHTML = "<li>Login to view stipend records.</li>";
  mealHistory.innerHTML = "<li>Login to view meal logs.</li>";
  menuContainer.innerHTML = "<p>Login to view the daily menu and place orders.</p>";
  activeOrdersBox.innerHTML = "<p>Login to track your active orders.</p>";
  cartBox.style.display = "none";
  if (mealLoggerCard) mealLoggerCard.style.display = "none";
});

window.addToCart = addToCart;

if (authToken) {
  studentLoginMessage.textContent = "Session restored.";
  loadMyData().catch(() => {
    authToken = "";
    localStorage.removeItem("student_token");
    studentLoginMessage.textContent = "Saved session expired. Please login again.";
  });
}

// Poll for active orders every 10 seconds
setInterval(() => {
  if (authToken) loadActiveOrders();
}, 10000);

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  const username = params.get("username");
  if (username && loginUsernameInput) {
    loginUsernameInput.value = username;
  }
  studentLoginMessage.textContent =
    "Registration successful. Please login to view your account and payment status.";
}

