import { auth, db } from "./firebase-config.js";
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  getDoc, 
  onSnapshot, 
  query, 
  orderBy,
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global Variables
let currentUser = null;
let unsubscribeLogs = null;
let isSignUp = false;
let allPastRecords = [];
let painChartInstance = null;
window.activeAnalyticsTab = "pain";

const BM_TYPE_COLORS = {
    2: "#8e44ad", // Gray 
    3: "#2980b9", // Purple
    4: "#27ae60", // Blue
    5: "#f1c40f", // Green
    6: "#e67e22", // Yellow
    7: "#e74c3c", // Orange
    1: "#7f8c8d"  // Red
};

// DOM Elements
const userEmailEl = document.getElementById("user-email");
const logForm = document.getElementById("log-form");
const editingDocIdInput = document.getElementById("editing-doc-id");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const saveLogBtn = document.getElementById("save-log-btn");

// Navigation Tabs
const tabNewBtn = document.getElementById("tab-new-btn");
const tabPastBtn = document.getElementById("tab-past-btn");
const sectionNewEntry = document.getElementById("section-new-entry");
const sectionPastRecords = document.getElementById("section-past-records");
const logList = document.getElementById("log-list");

// Analytics Elements
const openAnalyticsBtn = document.getElementById("open-analytics-btn");
const closeAnalyticsBtn = document.getElementById("close-analytics-btn");
const analyticsModal = document.getElementById("analytics-modal");
const analyticsMonthInput = document.getElementById("analytics-month");

// Containers
const bmContainer = document.getElementById("bm-container");
const formulaContainer = document.getElementById("formula-container");
const activitiesContainer = document.getElementById("activities-container");
const waterContainer = document.getElementById("water-container");
const herbalContainer = document.getElementById("herbal-container");
const enteragramContainer = document.getElementById("enteragram-container");
const painContainer = document.getElementById("pain-container");
const moodContainer = document.getElementById("mood-container");
const behaviorContainer = document.getElementById("behavior-container");
const cromolynContainer = document.getElementById("cromolyn-container");

// Add Row Buttons
const addBmBtn = document.getElementById("add-bm-btn");
const addFormulaBtn = document.getElementById("add-formula-btn");
const addActivityBtn = document.getElementById("add-activity-btn");
const addWaterBtn = document.getElementById("add-water-btn");
const addHerbalBtn = document.getElementById("add-herbal-btn");
const addEnteragramBtn = document.getElementById("add-enteragram-btn");
const addPainBtn = document.getElementById("add-pain-btn");
const addMoodBtn = document.getElementById("add-mood-btn");
const addBehaviorBtn = document.getElementById("add-behavior-btn");
const addCromolynBtn = document.getElementById("add-cromolyn-btn");


// Delete Entry Handler
async function deleteLogRecord(docId) {
  const confirmed = confirm("Are you sure you want to delete this care record? This action cannot be undone.");
  if (!confirmed || !currentUser) return;

  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "logs", docId));
    alert("Care record deleted successfully.");
  } catch (err) {
    console.error("Error deleting record:", err);
    alert("Failed to delete record. Please try again.");
  }
}

// Render filtered records to DOM
function renderRecordsList(records) {
  logList.innerHTML = "";

  if (records.length === 0) {
    logList.innerHTML = `<li style="color: #888; font-size: 0.9rem;">No matching care records found.</li>`;
    return;
  }

  records.forEach(({ docId, data }) => {
    const li = document.createElement("li");
    li.style.cssText = "background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 10px; list-style: none;";
    
    li.innerHTML = `
     <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap; gap: 4px;">
      <strong>📅 ${data.date} at ${formatTo12Hour(data.time)}</strong>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button type="button" class="view-log-btn" style="width: auto; padding: 3px 6px; font-size: 0.75rem; margin:0; background: #2ecc71;">View</button>
          <button type="button" class="edit-log-btn" style="width: auto; padding: 3px 6px; font-size: 0.75rem; margin:0; background: #4A90E2;">Edit</button>
          <button type="button" class="delete-log-btn" style="width: auto; padding: 3px 6px; font-size: 0.75rem; margin:0; background: #e74c3c;">Delete</button>
        </div>
      </div>
      <p style="margin: 6px 0; font-size: 0.9rem; color: #444;">
        <strong>BMs:</strong> ${data.bowelMovements ? data.bowelMovements.length : 0} logged | 
        <strong>Warm Water:</strong> ${Array.isArray(data.warmWater) ? data.warmWater.length : 0} entries
      </p>
      ${data.notes ? `<p style="margin: 4px 0; font-size: 0.85rem; color: #666; font-style: italic;">"${data.notes.slice(0, 60)}..."</p>` : ''}
    `;

    li.querySelector(".view-log-btn").addEventListener("click", () => showViewModal(data));
    li.querySelector(".edit-log-btn").addEventListener("click", () => populateFormForEdit(docId, data));
    li.querySelector(".delete-log-btn").addEventListener("click", () => deleteLogRecord(docId));

    logList.appendChild(li);
  });
}

// Filter Logic Function
function applySearchAndFilter() {
  const filterDate = document.getElementById("filter-date-input")?.value || "";

  const filtered = allPastRecords.filter(({ data }) => {
    return !filterDate || data.date === filterDate;
  });

  renderRecordsList(filtered);
}

// Load Firestore Records into Cache & Add Listeners
function loadPastRecords(userId) {
    const q = query(collection(db, "users", userId, "logs"), orderBy("date", "desc"));
    
    unsubscribeLogs = onSnapshot(q, (snapshot) => {
      allPastRecords = [];
      snapshot.forEach((docSnap) => {
        allPastRecords.push({ docId: docSnap.id, data: docSnap.data() });
      });
      
      window.allRecords = allPastRecords;
  
      applySearchAndFilter();
    });
}

// Search and Filter Event Listeners
document.getElementById("filter-date-input")?.addEventListener("change", applySearchAndFilter);
document.getElementById("clear-filter-btn")?.addEventListener("click", () => {
    const dateInput = document.getElementById("filter-date-input");
    if (dateInput) dateInput.value = "";
    applySearchAndFilter();
});

// Toggle Handler
function handleAuthToggle() {
    isSignUp = !isSignUp;
    document.getElementById("auth-title").textContent = isSignUp ? "Sign Up" : "Sign In";
    document.getElementById("auth-btn").textContent = isSignUp ? "Sign Up" : "Sign In";
    
    document.getElementById("toggle-wrapper").innerHTML = isSignUp 
      ? `Already have an account? <span class="toggle-link" id="toggle-auth" style="color: #4A90E2; cursor: pointer; text-decoration: underline;">Sign In</span>`
      : `Don't have an account? <span class="toggle-link" id="toggle-auth" style="color: #4A90E2; cursor: pointer; text-decoration: underline;">Sign Up</span>`;
}
  
document.getElementById("toggle-wrapper")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "toggle-auth") {
        handleAuthToggle();
    }
});

// Authentication State Tracker
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userEmailEl.textContent = user.email;
    document.getElementById("dashboard").classList.remove("hidden");
    document.getElementById("auth-card")?.classList.add("hidden");
    
    resetForm();
    loadPastRecords(user.uid);
  } else {
    currentUser = null;
    if (unsubscribeLogs) unsubscribeLogs();
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("auth-card")?.classList.remove("hidden");
  }
});

// Logout Listener
document.getElementById("logout-btn")?.addEventListener("click", () => {
  signOut(auth);
});

// Tab Switcher
tabPastBtn.addEventListener("click", () => {
  tabPastBtn.style.backgroundColor = "#4A90E2";
  tabNewBtn.style.backgroundColor = "#888";
  sectionPastRecords.classList.remove("hidden");
  sectionNewEntry.classList.add("hidden");
});

// Password Visibility Toggle
document.getElementById("show-password")?.addEventListener("change", (e) => {
  const pwdInput = document.getElementById("password");
  pwdInput.type = e.target.checked ? "text" : "password";
});

// Auth Form Handler
document.getElementById("auth-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const usernameVal = document.getElementById("username").value.trim().toLowerCase();
  const passwordVal = document.getElementById("password").value;
  const errorMsg = document.getElementById("error-msg");
  
  errorMsg.textContent = "";
  const email = usernameVal.includes("@") ? usernameVal : `${usernameVal}@app.local`;

  try {
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, passwordVal);
    } else {
      await signInWithEmailAndPassword(auth, email, passwordVal);
    }
  } catch (err) {
    console.error("Auth Error:", err);
    errorMsg.textContent = err.message.replace("Firebase: ", "");
  }
});

// --- DYNAMIC ROW GENERATION ---

function updateWaterRowLabels() {
  const rows = waterContainer.querySelectorAll(".water-row");
  rows.forEach((row, index) => {
    const num = index + 1;
    let suffix = "th";
    if (num % 10 === 1 && num % 100 !== 11) suffix = "st";
    else if (num % 10 === 2 && num % 100 !== 12) suffix = "nd";
    else if (num % 10 === 3 && num % 100 !== 13) suffix = "rd";

    const label = row.querySelector(".water-label");
    if (label) {
      label.textContent = `${num}${suffix} Cup:`;
    }
  });
}

function addWaterRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row water-row";
    row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 6px; width: 100%;";
    
    row.innerHTML = `
      <span class="water-label" style="font-size: 0.85rem; font-weight: bold; width: 75px; text-align: left;">1st Cup:</span>
      <input type="time" class="water-time" value="${data.time || ''}" style="flex: 1; margin: 0; width: 100%; text-align: center;" />
      <button type="button" class="remove-row-btn" style="background: #e74c3c; width: 28px; height: 28px; padding: 0; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center;">X</button>
    `;
    
    row.querySelector(".remove-row-btn").addEventListener("click", () => {
      row.remove();
      updateWaterRowLabels();
    });
  
    waterContainer.appendChild(row);
    updateWaterRowLabels();
}

function addHerbalRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row herbal-row";
  row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";
  
  row.innerHTML = `
    <input type="text" class="herbal-name" placeholder="Medicine Name" value="${data.name || ''}" style="flex: 2; margin: 0;" />
    <input type="time" class="herbal-time" value="${data.time || ''}" style="width: 130px; margin: 0;" />
    <button type="button" class="remove-row-btn" style="background: #e74c3c; width: auto; padding: 4px 8px; font-size: 0.8rem; margin: 0;">X</button>
  `;
  
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  herbalContainer.appendChild(row);
}

function addEnteragramRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row enteragram-row";
  row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";
  
  row.innerHTML = `
    <input type="text" class="enteragram-dose" placeholder="Dose (e.g. 1 scoop / 5mg)" value="${data.dose || ''}" style="flex: 1; margin: 0;" />
    <input type="time" class="enteragram-time" value="${data.time || ''}" style="width: 130px; margin: 0;" />
    <button type="button" class="remove-row-btn" style="background: #e74c3c; width: auto; padding: 4px 8px; font-size: 0.8rem; margin: 0;">X</button>
  `;
  
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  enteragramContainer.appendChild(row);
}

function addBmRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row bm-row";
  row.style.cssText = "border: 1px solid #eee; padding: 8px; border-radius: 6px; margin-bottom: 8px; background: #fafafa;";
  
  const groupName = `bm-amt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  row.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
      <input type="time" class="bm-time" value="${data.time || ''}" style="flex: 1;" />
      <select class="bm-type" style="flex: 2;">
        <option value="">-- Type (1-7) --</option>
        ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${data.type == n ? 'selected' : ''}>Type ${n}</option>`).join('')}
      </select>
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <span style="font-size: 0.85rem; font-weight: bold;">Amount:</span>
      <div style="display: flex; gap: 12px; align-items: center;">
        <label style="display: flex; flex-direction: column; align-items: center; margin: 0; cursor: pointer; font-size: 0.85rem;">
          <input type="radio" name="${groupName}" value="S" ${data.amount === 'S' ? 'checked' : ''} style="margin: 0 0 2px 0;"> S
        </label>
        <label style="display: flex; flex-direction: column; align-items: center; margin: 0; cursor: pointer; font-size: 0.85rem;">
          <input type="radio" name="${groupName}" value="M" ${data.amount === 'M' ? 'checked' : ''} style="margin: 0 0 2px 0;"> M
        </label>
        <label style="display: flex; flex-direction: column; align-items: center; margin: 0; cursor: pointer; font-size: 0.85rem;">
          <input type="radio" name="${groupName}" value="L" ${data.amount === 'L' ? 'checked' : ''} style="margin: 0 0 2px 0;"> L
        </label>
      </div>
      <input type="text" class="bm-color" placeholder="Color" value="${data.color || ''}" style="flex: 1; margin:0;" />
      <button type="button" class="remove-row-btn" style="background: #e74c3c; width: auto; padding: 4px 8px; font-size: 0.8rem; margin:0;">X</button>
    </div>
  `;

  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  bmContainer.appendChild(row);
}

function addTextRow(container, className, placeholder, value = "") {
  const row = document.createElement("div");
  row.className = `dynamic-row ${className}`;
  row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px;";
  row.innerHTML = `
    <input type="text" class="row-input" placeholder="${placeholder}" value="${value}" style="flex: 1; margin: 0; font-size: 0.85rem;" />
    <button type="button" class="remove-row-btn" style="background: #e74c3c; width: auto; padding: 4px 10px; font-size: 0.8rem; margin:0;">X</button>
  `;

  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function addFormulaRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row formula-row";
    row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 6px; width: 100%;";
  
    const amountValue = data.amount !== undefined ? data.amount : 12;
    const timeValue = data.time || "";
  
    row.innerHTML = `
      <!-- Scoops Input (Stretched) -->
      <input type="number" class="formula-amount" value="${amountValue}" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; box-sizing: border-box;" />
  
      <!-- Time Input (Fixed Width to Match Enteragram) -->
      <input type="time" class="formula-time" value="${timeValue}" style="width: 130px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; text-align: center; box-sizing: border-box; flex-shrink: 0;" />
  
      <!-- Delete Button -->
      <button type="button" class="remove-row-btn" style="background: #e74c3c; color: white; border: none; border-radius: 4px; width: 28px; height: 28px; font-size: 0.8rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">X</button>
    `;
  
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    formulaContainer.appendChild(row);
}

// Event Listeners for Adding Rows
addBmBtn?.addEventListener("click", () => addBmRow());
addFormulaBtn?.addEventListener("click", () => addFormulaRow());
addActivityBtn?.addEventListener("click", () => addTextRow(activitiesContainer, "activity-row", "Activity Details"));
addWaterBtn?.addEventListener("click", () => addWaterRow());
addHerbalBtn?.addEventListener("click", () => addHerbalRow());
addEnteragramBtn?.addEventListener("click", () => addEnteragramRow());
addPainBtn?.addEventListener("click", () => addPainRow());
addMoodBtn?.addEventListener("click", () => addMoodRow());
addBehaviorBtn?.addEventListener("click", () => addBehaviorRow());
addCromolynBtn?.addEventListener("click", () => addCromolynRow());

function resetForm() {
  logForm.reset();
  editingDocIdInput.value = "";
  saveLogBtn.textContent = "Save Care Log";
  cancelEditBtn.classList.add("hidden");

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  document.getElementById("log-date").value = `${year}-${month}-${day}`;
  document.getElementById("log-time").value = now.toTimeString().slice(0, 5);

  bmContainer.innerHTML = "";
  formulaContainer.innerHTML = "";
  activitiesContainer.innerHTML = "";
  waterContainer.innerHTML = "";
  herbalContainer.innerHTML = "";
  enteragramContainer.innerHTML = "";
  painContainer.innerHTML = "";
  moodContainer.innerHTML = "";
  behaviorContainer.innerHTML = "";
  cromolynContainer.innerHTML = "";
  document.getElementById("day-summary-select").value = "";
  document.getElementById("day-notes").value = "";

  addBmRow(); 
  addBmRow();
  addFormulaRow();
  addFormulaRow();
  addTextRow(activitiesContainer, "activity-row", "#1 Activity");
  addTextRow(activitiesContainer, "activity-row", "#2 Activity");
  addWaterRow();
  addHerbalRow();     
  addEnteragramRow();
  addPainRow();
  addMoodRow();
  addBehaviorRow();
  addCromolynRow();
}

cancelEditBtn.addEventListener("click", resetForm);

// --- EXTRACT FORM DATA ---
function getFormData() {
  const bmData = [];
  document.querySelectorAll(".bm-row").forEach(row => {
    const time = row.querySelector(".bm-time").value;
    const type = row.querySelector(".bm-type").value;
    const color = row.querySelector(".bm-color").value;
    const checkedRadio = row.querySelector("input[type='radio']:checked");
    const amount = checkedRadio ? checkedRadio.value : "";
    if (time || type || color || amount) {
      bmData.push({ time, type, amount, color });
    }
  });

  const getValues = (selector) => {
    const vals = [];
    document.querySelectorAll(selector).forEach(row => {
      const input = row.querySelector(".row-input");
      if (input && input.value) { // Guard against null
        vals.push(input.value.trim());
      }
    });
    return vals;
  };

  const waterData = [];
  document.querySelectorAll(".water-row").forEach(row => {
    const time = row.querySelector(".water-time").value;
    if (time) waterData.push({ time });
  });

  const formulaEntries = [];
  document.querySelectorAll(".formula-row").forEach(row => {
  const amountInput = row.querySelector(".formula-amount");
  const timeInput = row.querySelector(".formula-time");
    if (amountInput || timeInput) {
        formulaEntries.push({
        amount: amountInput ? Number(amountInput.value) : 12,
        time: timeInput ? timeInput.value : ""
        });
    }
  });

  const herbalMeds = [];
  document.querySelectorAll(".herbal-row").forEach(row => {
    const name = row.querySelector(".herbal-name").value.trim();
    const time = row.querySelector(".herbal-time").value;
    if (name || time) herbalMeds.push({ name, time });
  });

  const enteragramDoses = [];
  document.querySelectorAll(".enteragram-row").forEach(row => {
    const dose = row.querySelector(".enteragram-dose").value.trim();
    const time = row.querySelector(".enteragram-time").value;
    if (dose || time) enteragramDoses.push({ dose, time });
  });

  const cromolynMeds = [];
  document.querySelectorAll(".cromolyn-row").forEach(row => {
    const name = row.querySelector(".cromolyn-name").value.trim();
    const time = row.querySelector(".cromolyn-time").value;
  if (name || time) cromolynMeds.push({ name, time });
  });

  const foodData = [];
document.querySelectorAll("#foods-grid .food-row").forEach(row => {
  const checkbox = row.querySelector("input[type='checkbox']");
  const amountInput = row.querySelector("input[type='text']");
  const isHighlighted = row.classList.contains("new-food-highlight");

  if (checkbox && (checkbox.checked || (amountInput && amountInput.value.trim() !== ""))) {
    foodData.push({
      name: checkbox.value,
      checked: checkbox.checked,
      amount: amountInput ? amountInput.value.trim() : "",
      isHighlighted: isHighlighted 
    });
  }
});
  

  const painLogs = [];
  document.querySelectorAll(".pain-row").forEach(row => {
    const level = row.querySelector(".pain-level").value;
    const time = row.querySelector(".pain-time").value;
    if (level || time) painLogs.push({ level, time });
  });

  const moodLogs = [];
  document.querySelectorAll(".mood-row").forEach(row => {
    const zone = row.querySelector(".mood-zone").value;
    const time = row.querySelector(".mood-time").value;
    if (zone || time) moodLogs.push({ zone, time });
  });

  const behaviorLogs = [];
  document.querySelectorAll(".behavior-row").forEach(row => {
    const selectEl = row.querySelector(".behavior-type");
    const customEl = row.querySelector(".behavior-custom");
    const time = row.querySelector(".behavior-time").value;

    const type = customEl ? customEl.value.trim() : (selectEl ? selectEl.value : "");

    if (type || time) {
        behaviorLogs.push({ type, time });
    }
  });

   // Local date fallback calculation
   const now = new Date();
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const day = String(now.getDate()).padStart(2, '0');
   const localToday = `${year}-${month}-${day}`;


  return {
    date: document.getElementById("log-date")?.value || localToday,
    time: document.getElementById("log-time")?.value || "",
    waterGoal: parseFloat(document.getElementById("water-goal-input")?.value) || 8,
    formulaGoal: parseFloat(document.getElementById("formula-goal-input")?.value) || 80,
    bowelMovements: bmData,
    cromolynMeds,
    herbalMeds,
    enteragramDoses,
    formulaHydration: formulaEntries,
    warmWater: waterData,
    activities: getValues(".activity-row"),
    enzymes: {
      noFenol: { checked: document.getElementById("enzyme-no-fenol").checked, notes: document.getElementById("enzyme-no-fenol-notes").value },
      carbDgts: { checked: document.getElementById("enzyme-carb-dgts").checked, notes: document.getElementById("enzyme-carb-dgts-notes").value },
      chew: { checked: document.getElementById("enzyme-chew").checked, notes: document.getElementById("enzyme-chew-notes").value }
    },
    foods: foodData,
    painLogs,
    moodLogs,
    behaviorLogs,
    daySummary: document.getElementById("day-summary-select")?.value || "", 
    notes: document.getElementById("day-notes")?.value || "",
    updatedAt: new Date()
  };
}

// --- SAVE / EDIT FIRESTORE LOG ---
logForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
  
    // 1. Get current time in HH:MM format
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
    // 2. Auto-fill any empty time inputs in the form
    const timeInputs = logForm.querySelectorAll('input[type="time"]');
    timeInputs.forEach(input => {
      if (!input.value) {
        input.value = currentTime;
      }
    });
  
    // 3. Now collect form data (which will now include the filled-in times)
    const logData = getFormData();
    const editingId = editingDocIdInput.value;
  
    try {
      if (editingId) {
        await setDoc(doc(db, "users", currentUser.uid, "logs", editingId), logData, { merge: true });
        alert("Care Log updated successfully!");
      } else {
        await addDoc(collection(db, "users", currentUser.uid, "logs"), logData);
        alert("Care Log saved successfully!");
      }
      resetForm();
    } catch (err) {
      console.error("Error saving record: ", err);
      alert("Error saving record. Please try again.");
    }
});

// Populate Form for Editing
function populateFormForEdit(id, data) {
    editingDocIdInput.value = id;
    saveLogBtn.textContent = "Update Care Log";
    cancelEditBtn.classList.remove("hidden");
  
    document.getElementById("log-date").value = data.date || "";
    document.getElementById("log-time").value = data.time || "";
  
    bmContainer.innerHTML = "";
    if (data.bowelMovements && data.bowelMovements.length > 0) {
      data.bowelMovements.forEach(bm => addBmRow(bm));
    } else {
      addBmRow();
    }
  
    waterContainer.innerHTML = "";
    if (Array.isArray(data.warmWater) && data.warmWater.length > 0) {
      data.warmWater.forEach(w => addWaterRow(w));
    } else {
      addWaterRow();
    }
  
    herbalContainer.innerHTML = "";
    if (Array.isArray(data.herbalMeds) && data.herbalMeds.length > 0) {
      data.herbalMeds.forEach(h => addHerbalRow(h));
    } else {
      addHerbalRow();
    }
  
    enteragramContainer.innerHTML = "";
    if (Array.isArray(data.enteragramDoses) && data.enteragramDoses.length > 0) {
      data.enteragramDoses.forEach(e => addEnteragramRow(e));
    } else {
      addEnteragramRow();
    }
  
    cromolynContainer.innerHTML = "";
    if (Array.isArray(data.cromolynMeds) && data.cromolynMeds.length > 0) {
      data.cromolynMeds.forEach(m => addCromolynRow(m));
    } else {
      addCromolynRow();
    }
  
    formulaContainer.innerHTML = "";
    if (data.formulaHydration && data.formulaHydration.length > 0) {
      data.formulaHydration.forEach(f => {
        if (typeof f === "object" && f !== null) {
          addFormulaRow(f);
        } else {
          addFormulaRow({ amount: f, time: "" });
        }
      });
    } else {
      addFormulaRow();
    }
  
    activitiesContainer.innerHTML = "";
    if (data.activities && data.activities.length > 0) {
      data.activities.forEach(a => addTextRow(activitiesContainer, "activity-row", "Activity Details", a));
    } else {
      addTextRow(activitiesContainer, "activity-row", "Activity Details");
    }
  
    painContainer.innerHTML = "";
    if (Array.isArray(data.painLogs) && data.painLogs.length > 0) {
      data.painLogs.forEach(p => addPainRow(p));
    } else {
      addPainRow();
    }
  
    moodContainer.innerHTML = "";
    if (Array.isArray(data.moodLogs) && data.moodLogs.length > 0) {
      data.moodLogs.forEach(m => addMoodRow(m));
    } else {
      addMoodRow();
    }
  
    behaviorContainer.innerHTML = "";
    if (Array.isArray(data.behaviorLogs) && data.behaviorLogs.length > 0) {
      data.behaviorLogs.forEach(b => addBehaviorRow(b));
    } else {
      addBehaviorRow();
    }
  
    if (data.enzymes) {
      document.getElementById("enzyme-no-fenol").checked = !!data.enzymes.noFenol?.checked;
      document.getElementById("enzyme-no-fenol-notes").value = data.enzymes.noFenol?.notes || "";
      document.getElementById("enzyme-carb-dgts").checked = !!data.enzymes.carbDgts?.checked;
      document.getElementById("enzyme-carb-dgts-notes").value = data.enzymes.carbDgts?.notes || "";
      document.getElementById("enzyme-chew").checked = !!data.enzymes.chew?.checked;
      document.getElementById("enzyme-chew-notes").value = data.enzymes.chew?.notes || "";
    }
  
    // Reset all checkboxes and inputs in foods grid first
    document.querySelectorAll("#foods-grid .food-row").forEach(row => {
      const checkbox = row.querySelector("input[type='checkbox']");
      const amountInput = row.querySelector("input[type='text']");
      if (checkbox) checkbox.checked = false;
      if (amountInput) amountInput.value = "";
    });
  
    // Populate saved foods
    if (Array.isArray(data.foods)) {
      const foodsContainer = document.getElementById("foods-grid");
    
      data.foods.forEach(savedFood => {
        let matchingRow = Array.from(document.querySelectorAll("#foods-grid .food-row")).find(row => {
          const checkbox = row.querySelector("input[type='checkbox']");
          return checkbox && checkbox.value.toLowerCase() === savedFood.name.toLowerCase();
        });
    
        // Check both property names so legacy logs don't break
        const highlighted = savedFood.isHighlighted || savedFood.isNew || false;
    
        // If missing from DOM, create dynamic row (passing empty unit string to keep argument positions aligned)
        if (!matchingRow && foodsContainer) {
          matchingRow = createFoodRowElement(
            savedFood.name, 
            savedFood.unit || "", 
            savedFood.amount || "", 
            !!savedFood.checked, 
            highlighted
          );
          foodsContainer.appendChild(matchingRow);
        } else if (matchingRow) {
          // Update existing row inputs directly
          const checkbox = matchingRow.querySelector("input[type='checkbox']");
          const amountInput = matchingRow.querySelector("input[type='text']");
    
          if (checkbox) checkbox.checked = !!savedFood.checked;
          if (amountInput) amountInput.value = savedFood.amount || "";
    
          // Apply or remove the highlight class based on saved state
          if (highlighted) {
            matchingRow.classList.add("new-food-highlight");
          } else {
            matchingRow.classList.remove("new-food-highlight");
          }
        }
      });
    }
  
    document.getElementById("day-summary-select").value = data.daySummary || "";
    document.getElementById("day-notes").value = data.notes || "";
    tabNewBtn.click();
}

// Pain Row Generator
function addPainRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row pain-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";

    row.innerHTML = `
        <select class="pain-level" style="flex: 2; margin: 0;">
        <option value="">-- Select Pain Level --</option>
        <option value="No Pain" ${data.level === 'No Pain' ? 'selected' : ''}>No pain</option>
        <option value="Minor Pain" ${data.level === 'Minor Pain' ? 'selected' : ''}>Minor pain</option>
        <option value="Severe Pain" ${data.level === 'Severe Pain' ? 'selected' : ''}>Severe pain</option>
        </select>
        <input type="time" class="pain-time" value="${data.time || ''}" style="width: 130px; margin: 0; text-align: center;" />
        <button type="button" class="remove-row-btn" style="background: #e74c3c; width: 28px; height: 28px; padding: 0; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center;">X</button>
    `;

    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    painContainer.appendChild(row);
}

// Mood Row Generator
function addMoodRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row mood-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";
    
    row.innerHTML = `
      <select class="mood-zone" style="flex: 2; margin: 0;">
        <option value="">-- Select Mood Zone --</option>
        <option value="Blue Zone" ${data.zone === 'Blue Zone' ? 'selected' : ''}>🔵 Blue Zone</option>
        <option value="Green Zone" ${data.zone === 'Green Zone' ? 'selected' : ''}>🟢 Green Zone</option>
        <option value="Yellow Zone" ${data.zone === 'Yellow Zone' ? 'selected' : ''}>🟡 Yellow Zone</option>
        <option value="Red Zone" ${data.zone === 'Red Zone' ? 'selected' : ''}>🔴 Red Zone</option>
      </select>
      <input type="time" class="mood-time" value="${data.time || ''}" style="width: 130px; margin: 0; text-align: center;" />
      <button type="button" class="remove-row-btn" style="background: #e74c3c; width: 28px; height: 28px; padding: 0; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center;">X</button>
    `;
    
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    moodContainer.appendChild(row);
  }

// Behavior Row Generator
function addBehaviorRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row behavior-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";
    
    // Check if saved data is custom text (not one of the predefined options)
    const predefined = ["Screaming", "Throwing", "Hyperactivity",""];
    const isCustom = data.type && !predefined.includes(data.type);
  
    row.innerHTML = `
      <div class="behavior-input-wrapper" style="flex: 2; display: flex; gap: 4px;">
        ${isCustom ? `
          <input type="text" class="behavior-custom" placeholder="Specify behavior..." value="${data.type}" style="flex: 1; margin: 0;" />
          <button type="button" class="reset-dropdown-btn" title="Back to dropdown" style="width: 28px; padding: 0; background: #888;">↺</button>
        ` : `
          <select class="behavior-type" style="width: 100%; margin: 0;">
            <option value="">-- Select Behavior --</option>
            <option value="Screaming" ${data.type === 'Screaming' ? 'selected' : ''}>Screaming</option>
            <option value="Throwing" ${data.type === 'Throwing' ? 'selected' : ''}>Throwing</option>
            <option value="Hyperactivity" ${data.type === 'Hyperactivity' ? 'selected' : ''}>Hyperactivity</option>
            <option value="Other">Other...</option>
          </select>
        `}
      </div>
      <input type="time" class="behavior-time" value="${data.time || ''}" style="width: 130px; margin: 0; text-align: center;" />
      <button type="button" class="remove-row-btn" style="background: #e74c3c; width: 28px; height: 28px; padding: 0; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center;">X</button>
    `;
  
    const wrapper = row.querySelector(".behavior-input-wrapper");
  
    // Handle switching to text input when "Other" is selected
    row.addEventListener("change", (e) => {
      if (e.target.classList.contains("behavior-type") && e.target.value === "Other") {
        wrapper.innerHTML = `
          <input type="text" class="behavior-custom" placeholder="Specify behavior..." style="flex: 1; margin: 0;" />
          <button type="button" class="reset-dropdown-btn" title="Back to dropdown" style="width: 28px; padding: 0; background: #888;">↺</button>
        `;
        wrapper.querySelector(".behavior-custom").focus();
      }
    });
  
    // Handle switching back to dropdown if user clicks reset ↺
    row.addEventListener("click", (e) => {
      if (e.target.classList.contains("reset-dropdown-btn")) {
        wrapper.innerHTML = `
          <select class="behavior-type" style="width: 100%; margin: 0;">
            <option value="">-- Select Behavior --</option>
            <option value="Screaming">Screaming</option>
            <option value="Throwing">Throwing</option>
            <option value="Hyperactivity">Hyperactivity</option>
            <option value="Other">Other...</option>
          </select>
        `;
      }
    });
  
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    behaviorContainer.appendChild(row);
}

function addCromolynRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row cromolyn-row";
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 6px; align-items: center;";
  
    row.innerHTML = `
      <input type="text" class="cromolyn-name" placeholder="Medicine Name" value="${data.name || ''}" style="flex: 1; margin: 0;" />
      <input type="time" class="cromolyn-time" value="${data.time || ''}" style="width: 130px; margin: 0; text-align: center;" />
      <button type="button" class="remove-row-btn" style="background: #e74c3c; width: 28px; height: 28px; padding: 0; font-size: 0.8rem; margin: 0; display: flex; align-items: center; justify-content: center;">X</button>
    `;
  
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    cromolynContainer.appendChild(row);
}

function formatTo12Hour(time24) {
    if (!time24) return 'N/A';
    const [hoursStr, minutes] = time24.split(':');
    let hours = parseInt(hoursStr, 10);
    if (isNaN(hours)) return time24; 
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; 
    return `${hours}:${minutes} ${ampm}`;
}

// Render read-only record details
function showViewModal(data) {
    const modal = document.getElementById("view-modal");
    const modalBody = document.getElementById("view-modal-body");
  
    modalBody.innerHTML = `
      <div style="padding-top: 15px; margin-bottom: 12px; text-align: left;">
          <br>
          <br>
          <h3 style="margin: 0; color: #2c3e50; font-size: 1.3rem;">📅 Care Log Summary</h3>
          <p style="margin: 6px 0 0 0; color: #555; font-size: 0.95rem; font-weight: bold;">
              Date: <span style="font-weight: normal; color: #333;">${data.date || 'N/A'}</span>
          </p>
          <p style="margin: 2px 0 0 0; color: #555; font-size: 0.9rem;">
              Log Entry Time: <span style="font-weight: normal; color: #333;">${formatTo12Hour(data.time)}</span>
          </p>
      </div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0 15px 0;" />
      
      <p><strong>Bowel Movements:</strong></p>
      <ul>
        ${data.bowelMovements?.length 
          ? data.bowelMovements.map(bm => `<li>Time: ${formatTo12Hour(bm.time)} | Type: ${bm.type || 'N/A'} | Amount: ${bm.amount || 'N/A'} | Color: ${bm.color || 'N/A'}</li>`).join('')
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Warm Water Log:</strong></p>
      <ul>
        ${Array.isArray(data.warmWater) && data.warmWater.length 
          ? data.warmWater.map((w, idx) => `<li>Cup ${idx + 1}: at ${formatTo12Hour(typeof w === 'object' ? w.time : w)}</li>`).join('')
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Cromolyn & Other Meds:</strong></p>
      <ul>
      ${data.cromolynMeds?.length 
          ? data.cromolynMeds.map(m => `<li>${m.name || 'Unnamed'}: at ${formatTo12Hour(m.time)}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Herbal Meds:</strong></p>
      <ul>
        ${data.herbalMeds?.length 
          ? data.herbalMeds.map(h => `<li>${h.name || 'Unnamed'}: at ${formatTo12Hour(h.time)}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Enteragram:</strong></p>
      <ul>
        ${data.enteragramDoses?.length 
          ? data.enteragramDoses.map(e => `<li>Dose: ${e.dose || 'N/A'} at ${formatTo12Hour(e.time)}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Formula:</strong></p>
      <ul>
        ${data.formulaHydration?.length 
          ? data.formulaHydration.map(f => `<li>${typeof f === 'object' ? `${f.name || 'Formula'}: at ${formatTo12Hour(f.time)}` : f}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Activities:</strong></p>
      <ul>
        ${data.activities?.length 
          ? data.activities.map(a => `<li>${typeof a === 'object' ? `${a.name || 'Activity'}: at ${formatTo12Hour(a.time)}` : a}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Foods:</strong></p>
      <ul>
        ${data.foods?.length 
          ? data.foods.map(f => `<li>${f.name}: ${f.amount || 'Checked'} ${f.time ? `at ${formatTo12Hour(f.time)}` : ''}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Pain Logs:</strong></p>
      <ul>
      ${data.painLogs?.length 
          ? data.painLogs.map(p => `<li>${p.level || 'Unspecified'}: at ${formatTo12Hour(p.time)}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Mood Logs:</strong></p>
      <ul>
      ${data.moodLogs?.length 
          ? data.moodLogs.map(m => `<li>${m.zone || 'Unspecified'}: at ${formatTo12Hour(m.time)}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
  
      <p><strong>Behavior Logs:</strong></p>
      <ul>
      ${data.behaviorLogs?.length 
          ? data.behaviorLogs.map(b => `<li>${b.type || 'Unspecified'}: at ${formatTo12Hour(b.time)}</li>`).join('') 
          : '<li>None recorded</li>'}
      </ul>
    
      <p><strong>Day Summary:</strong> ${data.daySummary || 'N/A'}</p>
      <p><strong>Notes:</strong> ${data.notes || 'No extra notes.'}</p>
    `;
  
    modal.classList.remove("hidden");
}

// Close Modal Event Handler
document.getElementById("close-modal-btn")?.addEventListener("click", () => {
  document.getElementById("view-modal").classList.add("hidden");
});


// Initialize month input to current month (YYYY-MM)
if (analyticsMonthInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    analyticsMonthInput.value = `${year}-${month}`;
}
  
// Event Listeners
closeAnalyticsBtn?.addEventListener("click", () => {
    analyticsModal.style.display = "none";
    analyticsModal.classList.add("hidden");
});
  
analyticsMonthInput?.addEventListener("change", () => {
    renderAnalyticsChart();
});

function setActiveTab(activeBtn) {
    [tabNewBtn, tabPastBtn, openAnalyticsBtn].forEach(btn => {
        if (btn) {
            btn.style.backgroundColor = (btn === activeBtn) ? "#4A90E2" : "#888";
        }
    });
}

// New Entry Tab
tabNewBtn?.addEventListener("click", () => {
    setActiveTab(tabNewBtn);
    document.getElementById("section-new-entry")?.classList.remove("hidden");
    document.getElementById("section-past-records")?.classList.add("hidden");
});

// Past Records Tab
tabPastBtn?.addEventListener("click", () => {
    setActiveTab(tabPastBtn);
    document.getElementById("section-past-records")?.classList.remove("hidden");
    document.getElementById("section-new-entry")?.classList.add("hidden");
});

// Reset highlight back to the visible tab when modal closes
closeAnalyticsBtn?.addEventListener("click", () => {
    analyticsModal.style.display = "none";
    analyticsModal.classList.add("hidden");
    
    const isPastVisible = !document.getElementById("section-past-records")?.classList.contains("hidden");
    setActiveTab(isPastVisible ? tabPastBtn : tabNewBtn);
});

// Attach listeners to date inputs
document.getElementById("analytics-start-date")?.addEventListener("change", () => {
    window.activeCalendarMonth = null; // Reset to auto-select initial month
    renderAnalyticsChart();
});
  
  document.getElementById("analytics-end-date")?.addEventListener("change", () => {
    window.activeCalendarMonth = null;
    renderAnalyticsChart();
});

openAnalyticsBtn?.addEventListener("click", () => {
    setActiveTab(openAnalyticsBtn);
    
    const startDateInput = document.getElementById("analytics-start-date");
    const endDateInput = document.getElementById("analytics-end-date");
  
    if (startDateInput && endDateInput && (!startDateInput.value || !endDateInput.value)) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      startDateInput.value = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      endDateInput.value = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }
  
    analyticsModal.style.display = "flex";
    analyticsModal.classList.remove("hidden");
  
    setTimeout(() => {
      renderAnalyticsChart();
    }, 100);
});

const startDateInput = document.getElementById("analytics-start-date");
const endDateInput = document.getElementById("analytics-end-date");

document.querySelectorAll('input[type="date"]').forEach(input => {
    input.style.cursor = "pointer";
    input.addEventListener("pointerdown", function(e) {
      // Check if browser supports showPicker
      if (typeof this.showPicker === "function") {
        // Prevent double-triggering default focus behavior
        e.preventDefault(); 
        this.showPicker();
      }
    });
});

window.activeCalendarMonth = null;

function renderPainCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  // Extract all "YYYY-MM" months in the chosen date range
  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) {
      monthsInRange.push(key);
    }
    // Advance to 1st of next month
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  // Preserve active month selection or fallback to initial month
  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  // Render Month Selector Buttons
  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#2c3e50";
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
            window.activeCalendarMonth = mKey;
            renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  // Update Dynamic Title
  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} Pain Calendar`;
  }

  // Filter logs for selected month
  const datePainMap = {};

  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    const painLogs = logData.painLogs || [];
    painLogs.forEach(log => {
      const levelVal = typeof log === "string" ? log : (log.level || log.painLevel || log.value || "");
      const levelStr = String(levelVal).trim().toLowerCase();

      let rawTime = (typeof log === "object" && log !== null) ? (log.time || log.logTime || "") : "";
      if (!rawTime) rawTime = logData.time || "";

      let displayTime = rawTime;
      if (rawTime && rawTime.includes(":")) {
        const [h, m] = rawTime.split(":");
        let hours = parseInt(h, 10);
        const suffix = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        displayTime = `${hours}:${m} ${suffix}`;
      }

      let color = null;
      let label = "";

      if (levelStr === "severe pain" || levelStr === "severe") {
        color = "#e74c3c";
        label = "Severe";
      } else if (levelStr === "minor pain" || levelStr === "minor") {
        color = "#f1c40f";
        label = "Minor";
      } else if (levelStr === "no pain" || levelStr === "no") {
        color = "#2ecc71";
        label = "No Pain";
      }

      if (color) {
        if (!datePainMap[logDate]) {
          datePainMap[logDate] = [];
        }
        datePainMap[logDate].push({ color, label, time: displayTime });
      }
    });
  });

  // Render Days Grid
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "4px 0";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStr}`;
    const entries = datePainMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.flexDirection = "column";
    badgeContainer.style.gap = "2px";
    badgeContainer.style.width = "100%";
    badgeContainer.style.alignItems = "center";

    entries.forEach(entry => {
      const badge = document.createElement("span");
      badge.style.backgroundColor = entry.color;
      badge.style.color = entry.color === "#f1c40f" ? "#333" : "#fff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 3px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap";
      badge.innerText = entry.time ? entry.time : entry.label;
      badge.title = `${entry.label}${entry.time ? ' at ' + entry.time : ''}`;
      badgeContainer.appendChild(badge);
    });

    cell.appendChild(badgeContainer);
    grid.appendChild(cell);
  }
}

document.getElementById("analytics-view-select")?.addEventListener("change", (e) => {
  window.activeAnalyticsTab = e.target.value;
  window.activeCalendarMonth = null; // Reset active month view on tab swap
  
  renderAnalyticsChart();
});

async function renderAnalyticsChart() {
  const startDate = document.getElementById("analytics-start-date")?.value;
  const endDate = document.getElementById("analytics-end-date")?.value;
  const canvas = document.getElementById("analyticsChart");
  const chartTitle = document.getElementById("chart-title");
  if (!canvas) return;

  const titleCard = chartTitle?.closest(".card") || chartTitle?.parentElement;
  const canvasCard = canvas?.closest(".card") || canvas?.parentElement;

  const viewSelect = document.getElementById("analytics-view-select");
  const activeView = viewSelect ? viewSelect.value : (window.activeAnalyticsTab || "pain");
  const records = window.allRecords || allPastRecords || [];

  // Toggle chart container visibility based on active view
  if (activeView === "food" || activeView === "foods") {
    if (titleCard) titleCard.style.display = "none";
    if (canvasCard) canvasCard.style.display = "none";
    
    renderFirstFoodCalendar(startDate, endDate, records);
    return; // Stop execution so no chart logic runs
  } else {
    if (titleCard) titleCard.style.display = "block";
    if (canvasCard) canvasCard.style.display = "block";
    if (canvas) canvas.style.display = "block";
  }

  // Re-render shared month navigation
  renderMonthNavigation(startDate, endDate);

  // --- PAIN VIEW ---
  if (activeView === "pain") {
    if (chartTitle) chartTitle.innerText = "Days Experienced per Pain Level";

    const painCounts = { "No Pain": 0, "Minor Pain": 0, "Severe Pain": 0 };

    records.forEach(item => {
      const logData = item.data || item;
      if (!logData.date) return;
      if (startDate && logData.date < startDate) return;
      if (endDate && logData.date > endDate) return;

      (logData.painLogs || []).forEach(log => {
        const val = String(typeof log === "string" ? log : log.level || log.painLevel || "").toLowerCase();
        if (val.includes("severe")) painCounts["Severe Pain"]++;
        else if (val.includes("minor")) painCounts["Minor Pain"]++;
        else if (val.includes("no")) painCounts["No Pain"]++;
      });
    });

    drawChart(
      canvas, 
      ["No Pain", "Minor Pain", "Severe Pain"], 
      [painCounts["No Pain"], painCounts["Minor Pain"], painCounts["Severe Pain"]], 
      ["#2ecc71", "#f1c40f", "#e74c3c"],
      "Days"
    );
    renderPainCalendar(startDate, endDate, records);

  // --- BOWEL MOVEMENTS VIEW ---
  } else if (activeView === "bm") {
    if (chartTitle) chartTitle.innerText = "Bowel Movements by Type";

    const typeCounts = {};
    records.forEach(item => {
      const logData = item.data || item;
      if (!logData.date) return;
      if (startDate && logData.date < startDate) return;
      if (endDate && logData.date > endDate) return;

      (logData.bowelMovements || []).forEach(bm => {
        if (!bm.type) return;
        const label = `Type ${bm.type}`;
        typeCounts[label] = (typeCounts[label] || 0) + 1;
      });
    });

    const sortedKeys = Object.keys(typeCounts).sort((a, b) => {
      return parseInt(a.replace("Type ", ""), 10) - parseInt(b.replace("Type ", ""), 10);
    });

    const labels = sortedKeys.length ? sortedKeys : ["No Logged Types"];
    const data = sortedKeys.length ? sortedKeys.map(k => typeCounts[k]) : [0];
    const barColors = sortedKeys.length 
      ? sortedKeys.map(k => BM_TYPE_COLORS[parseInt(k.replace("Type ", ""), 10)] || "#8e44ad")
      : ["#bdc3c7"];

    drawChart(canvas, labels, data, barColors, "Days");
    renderBMCalendar(startDate, endDate, records);

  // --- FORMULA VIEW ---
  } else if (activeView === "formula") {
    if (chartTitle) chartTitle.innerText = "Formula Intake Overview";

    const formulaGoal = await getGoal("formula");
  
    const formulaByDate = {};
    records.forEach(item => {
      const logData = item.data || item;
      if (!logData.date) return;
      if (startDate && logData.date < startDate) return;
      if (endDate && logData.date > endDate) return;
  
      const formulaEntries = logData.formulaHydration || logData.formula || [];
      
      let entryTotal = 0;
      formulaEntries.forEach(f => {
        const scoops = typeof f === "object" ? parseFloat(f.amount || f.scoops || 0) : parseFloat(f || 0);
        entryTotal += isNaN(scoops) ? 0 : scoops;
      });
  
      if (entryTotal > 0) {
        formulaByDate[logData.date] = (formulaByDate[logData.date] || 0) + entryTotal;
      }
    });
  
    const dates = Object.keys(formulaByDate).sort();
    const labels = dates.length ? dates : ["No Data"];
    const data = dates.length ? dates.map(d => formulaByDate[d]) : [0];
  
    drawScatterChart(canvas, labels, data, "#e54363", "Formula Scoops", "Total Scoops", "Date", formulaGoal, "Scoops", 10);
    renderFormulaCalendar(startDate, endDate, records);

  // --- WATER VIEW ---
  } else if (activeView === "water") {
    if (chartTitle) chartTitle.innerText = "Water Cups Intake Overview";

    const waterGoal = await getGoal("water");
  
    const waterByDate = {};
    records.forEach(item => {
      const logData = item.data || item;
      const logDate = logData.date;
      if (!logDate) return;
  
      // Filter by overall start/end date range instead of locking to a single active month
      if (startDate && logDate < startDate) return;
      if (endDate && logDate > endDate) return;
  
      const waterEntries = logData.warmWater || logData.water || [];
      
      // Calculate total cups for this entry
      let totalCups = 0;
      if (Array.isArray(waterEntries)) {
        totalCups = waterEntries.reduce((sum, entry) => {
          const val = typeof entry === "object" ? parseFloat(entry.amount || entry.cups || 1) : parseFloat(entry);
          return sum + (isNaN(val) ? 1 : val);
        }, 0);
      } else {
        const parsed = parseFloat(waterEntries);
        totalCups = isNaN(parsed) ? 0 : parsed;
      }
  
      // Accumulate daily totals across all matching months
      if (totalCups > 0) {
        waterByDate[logDate] = (waterByDate[logDate] || 0) + totalCups;
      }
    });
  
    const dates = Object.keys(waterByDate).sort();
    const labels = dates.length ? dates : ["No Data"];
    const data = dates.length ? dates.map(d => waterByDate[d]) : [0];
  
    drawScatterChart(canvas, labels, data, "#1abc9c", "Cups of Water", "Cups of Water", "Date", waterGoal, "Cups", 1);
  
    renderWaterCalendar(startDate, endDate, records);
  }
  //Mood view
  else if (activeView === "mood") {
    if (chartTitle) chartTitle.innerText = "Mood Logs Breakdown";

    const moodCounts = {
      "Blue Zone": 0,
      "Green Zone": 0,
      "Yellow Zone": 0,
      "Red Zone": 0
    };

    records.forEach(item => {
      const logData = item.data || item;
      if (!logData.date) return;
      if (startDate && logData.date < startDate) return;
      if (endDate && logData.date > endDate) return;

      const moods = logData.moodLogs || logData.moods || logData.mood || [];
      const moodList = Array.isArray(moods) ? moods : [moods];

      moodList.forEach(m => {
        if (!m) return;
        
        const zoneVal = typeof m === "object" ? (m.zone || m.label || m.type || "") : String(m);
        const cleanVal = zoneVal.trim();

        if (cleanVal && moodCounts.hasOwnProperty(cleanVal)) {
          moodCounts[cleanVal]++;
        } else if (cleanVal) {
          moodCounts[cleanVal] = (moodCounts[cleanVal] || 0) + 1;
        }
      });
    });

    const labels = ["Blue Zone", "Green Zone", "Yellow Zone", "Red Zone"];
    const chartData = labels.map(l => moodCounts[l]);
    const chartColors = ["#3498db", "#2ecc71", "#f1c40f", "#e74c3c"];

    drawChart(canvas, labels, chartData, chartColors, "Days");
    renderMoodCalendar(startDate, endDate, records);

  // --- BEHAVIOR VIEW ---
  } else if (activeView === "behavior") {
    if (chartTitle) chartTitle.innerText = "Logged Behaviors Frequency";

    const behaviorCounts = {};

    records.forEach(item => {
      const logData = item.data || item;
      if (!logData.date) return;
      if (startDate && logData.date < startDate) return;
      if (endDate && logData.date > endDate) return;

      const behaviors = logData.behaviorLogs || logData.behaviors || logData.behavior || [];
      const bList = Array.isArray(behaviors) ? behaviors : [behaviors];

      bList.forEach(b => {
        const val = typeof b === "object" ? (b.name || b.type || b.label || b.behavior || "") : String(b);
        if (val.trim()) {
          const key = val.charAt(0).toUpperCase() + val.slice(1);
          behaviorCounts[key] = (behaviorCounts[key] || 0) + 1;
        }
      });
    });

    const palette = ["#e67e22", "#e74c3c", "#1abc9c", "#34495e", "#9b59b6", "#3498db", "#f1c40f"];
    const labels = Object.keys(behaviorCounts).sort();
    
    const colorMap = {};
    labels.forEach((label, idx) => {
      colorMap[label] = palette[idx % palette.length];
    });

    const chartLabels = labels.length ? labels : ["No Behavior Data"];
    const chartData = labels.length ? labels.map(l => behaviorCounts[l]) : [0];
    const chartColors = labels.length ? labels.map(l => colorMap[l]) : ["#e67e22"];

    drawChart(canvas, chartLabels, chartData, chartColors, "Days");
    renderBehaviorCalendar(startDate, endDate, records, colorMap);

  // --- DAY SUMMARY VIEW ---
  } else if (activeView === "summary") {
    if (chartTitle) chartTitle.innerText = "Day Summary Rating Frequency";

    const summaryCounts = {
      "Very Good": 0,
      "Good": 0,
      "OK": 0,
      "Difficult": 0,
      "Very Difficult": 0
    };

    records.forEach(item => {
      const logData = item.data || item;
      if (!logData.date) return;
      if (startDate && logData.date < startDate) return;
      if (endDate && logData.date > endDate) return;

      const val = String(logData.daySummaryStatus || logData.daySummary || logData.summary || "").toLowerCase();

      if (val.includes("very good")) summaryCounts["Very Good"]++;
      else if (val.includes("very difficult")) summaryCounts["Very Difficult"]++;
      else if (val.includes("good")) summaryCounts["Good"]++;
      else if (val.includes("ok")) summaryCounts["OK"]++;
      else if (val.includes("difficult")) summaryCounts["Difficult"]++;
    });

    drawChart(
      canvas,
      ["Very Good", "Good", "OK", "Difficult", "Very Difficult"],
      [
        summaryCounts["Very Good"],
        summaryCounts["Good"],
        summaryCounts["OK"],
        summaryCounts["Difficult"],
        summaryCounts["Very Difficult"]
      ],
      ["#2ecc71", "#3498db", "#f1c40f", "#e67e22", "#e74c3c"],
      "Days"
    );

    renderSummaryCalendar(startDate, endDate, records);

  // --- NEW FOOD INTRODUCTIONS VIEW ---
  } else if (activeView === "food" || activeView === "foods") {
    // Target the entire outer card container, not just the canvas element
    if (chartCard) {
      chartCard.style.display = "none";
    }
  
    renderFirstFoodCalendar(startDate, endDate, records);
  }
}

  
function drawChart(canvas, labels, data, barColors, yLabel = "Days") {
  if (!canvas) return;

  // Destroy old instance if stored
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }

  const ctx = canvas.getContext("2d");
  canvas.chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: barColors
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: {
            display: true,
            text: yLabel,
            font: { weight: "bold" }
          }
        }
      }
    }
  });
}

function drawScatterChart(canvas, labels, data, color, datasetLabel, yLabel = "Value", xLabel = "Date", targetGoal = null, unit = "Units", stepSize = null) {
  if (!canvas) return;

  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }

  const datasets = [{
    label: datasetLabel,
    data: data,
    borderColor: color,
    backgroundColor: color,
    showLine: false,
    pointRadius: 6
  }];

  if (targetGoal !== null) {
    datasets.push({
      label: `Goal (${targetGoal} ${unit})`,
      data: new Array(labels.length).fill(targetGoal),
      borderColor: "#e74c3c",
      backgroundColor: "transparent",
      showLine: true,
      borderDash: [6, 6],
      pointRadius: 0,
      fill: false
    });
  }

  const ctx = canvas.getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: "top"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: targetGoal ? targetGoal + (unit === "Scoops" ? 20 : 2) : undefined,
          ticks: {
            precision: 0,
            ...(stepSize && { stepSize: stepSize }) // Applies integer step intervals (1, 2, 3...) when passed
          },
          title: {
            display: true,
            text: yLabel,
            font: { weight: "bold" }
          }
        },
        x: {
          title: {
            display: true,
            text: xLabel,
            font: { weight: "bold" }
          }
        }
      }
    }
  });
}

function renderBMCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  // Extract all "YYYY-MM" months in range
  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");
  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) monthsInRange.push(key);
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  // Render Month Navigation Buttons for BM
  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });
        
        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#8e44ad"; // BM theme color
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
          window.activeCalendarMonth = mKey;
          renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  // Update Header Title
  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} BM Calendar`;
  }

  // Map BM records for active month
  const bmMap = {};
  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    (logData.bowelMovements || []).forEach(bm => {
      if (!bm.type) return;

      if (!bmMap[logDate]) bmMap[logDate] = [];
      bmMap[logDate].push({
          time: formatTo12Hour(bm.time),
          type: bm.type,
          amount: bm.amount || bm.size || "", 
          color: bm.color || ""             
      });
    });
  });

  // Render Day Headers & Days Grid
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const dayStrFormatted = String(d).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStrFormatted}`;
    const entries = bmMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    // Added explicit centering to match Pain Calendar cells
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "2px";
    container.style.width = "100%";
    // Added explicit alignment so child badges don't stretch edge-to-edge
    container.style.alignItems = "center";

    entries.forEach(entry => {
      const badge = document.createElement("span");
      const typeColor = BM_TYPE_COLORS[entry.type] || "#8e44ad";
      
      badge.style.backgroundColor = typeColor;
      badge.style.color = typeColor === "#f1c40f" ? "#333" : "#fff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 3px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap"; // Prevents layout wrapping
      badge.style.cursor = "pointer";
      badge.innerText = entry.time;
    
      // Construct dynamic hover tooltip
      let tooltipText = `Type: ${entry.type} at ${entry.time}`;
      if (entry.amount) tooltipText += `\nAmount: ${entry.amount.toUpperCase()}`;
      if (entry.color) tooltipText += `\nColor: ${entry.color}`;
    
      badge.title = tooltipText;
      container.appendChild(badge);
    });

    cell.appendChild(container);
    grid.appendChild(cell);
  }
}

function calculateWaterCups(waterEntries) {
  if (Array.isArray(waterEntries)) {
    return waterEntries.reduce((sum, entry) => {
      if (typeof entry === "object" && entry !== null) {
        return sum + (parseFloat(entry.amount || entry.cups || entry.value || 1) || 0);
      }
      return sum + (parseFloat(entry) || 1);
    }, 0);
  }
  return parseFloat(waterEntries) || 0;
}

function createFoodRowElement(foodName, unit = "", amount = "", isChecked = false, isHighlighted = true) {
  const row = document.createElement("div");
  row.className = `food-row ${isHighlighted ? "new-food-highlight" : ""}`;

  const safeId = `food-${foodName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const placeholderText = unit ? `Amount (${unit})` : "Amount";

  row.innerHTML = `<input type="checkbox" id="${safeId}" name="food-check" value="${foodName}" ${isChecked ? "checked" : ""}><label for="${safeId}">${foodName}</label><input type="text" name="food-amount" placeholder="${placeholderText}" value="${amount}" />`;

  return row;
}

document.getElementById("foods-grid")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-food-btn")) {
    const foodToRemove = e.target.getAttribute("data-food");

    // Update localStorage
    let customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");
    customFoods = customFoods.filter(f => f.name.toLowerCase() !== foodToRemove.toLowerCase());
    localStorage.setItem("customFoods", JSON.stringify(customFoods));

    // Remove row from DOM
    const row = e.target.closest(".food-row");
    if (row) row.remove();
  }
});
  
  // Add Custom Food Button Handler
document.getElementById("add-custom-food-btn")?.addEventListener("click", () => {
    const nameInput = document.getElementById("new-food-input");
    const unitInput = document.getElementById("new-food-unit");
  
    const foodName = nameInput.value.trim();
    const unit = unitInput ? unitInput.value.trim() : "";
  
    if (!foodName) return;
  
    // Save food with isHighlighted default set to true
    const customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");
    if (!customFoods.some(f => f.name.toLowerCase() === foodName.toLowerCase())) {
      customFoods.push({ name: foodName, unit: unit, isHighlighted: true });
      localStorage.setItem("customFoods", JSON.stringify(customFoods));
    }
  
    // Create row with highlight enabled
    const foodsContainer = document.getElementById("foods-grid");
    const newRow = createFoodRowElement(foodName, unit, "", false, true);
    foodsContainer.appendChild(newRow);
  
    // Clear inputs
    nameInput.value = "";
    if (unitInput) unitInput.value = "";
});
  

function loadStoredCustomFoods() {
  const foodsContainer = document.getElementById("foods-grid");
  if (!foodsContainer) return;

  const customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");
  customFoods.forEach(food => {
    const existing = Array.from(foodsContainer.querySelectorAll("label")).some(
      lbl => lbl.textContent.toLowerCase() === food.name.toLowerCase()
    );

    if (!existing) {
      const row = createFoodRowElement(food.name, food.unit || "", "", false, food.isHighlighted);
      foodsContainer.appendChild(row);
    }
  });
}
  
loadStoredCustomFoods();

// Remove checked custom foods
document.getElementById("remove-selected-food-btn")?.addEventListener("click", () => {
  const container = document.getElementById("foods-grid");
  if (!container) return;

  const checkedInputs = container.querySelectorAll('input[name="food-check"]:checked');
  let customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");

  checkedInputs.forEach(input => {
    const foodName = input.value;
    const row = input.closest(".food-row");

    // Only allow removing custom items, keeping standard default items safe
    const isCustom = customFoods.some(f => f.name.toLowerCase() === foodName.toLowerCase());
    if (isCustom) {
      customFoods = customFoods.filter(f => f.name.toLowerCase() !== foodName.toLowerCase());
      if (row) row.remove();
    }
  });

  localStorage.setItem("customFoods", JSON.stringify(customFoods));
});

// Toggle highlight state on checked foods
document.getElementById("toggle-highlight-btn")?.addEventListener("click", () => {
  const container = document.getElementById("foods-grid");
  if (!container) return;

  const checkedInputs = container.querySelectorAll('input[name="food-check"]:checked');
  let customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");

  checkedInputs.forEach(input => {
    const row = input.closest(".food-row");
    if (!row) return;

    const foodName = input.value;
    const isCurrentlyHighlighted = row.classList.contains("new-food-highlight");

    // 1. Toggle visual class on DOM element immediately
    row.classList.toggle("new-food-highlight");

    // 2. If it's a custom food, update its saved state in localStorage
    const customIndex = customFoods.findIndex(f => f.name.toLowerCase() === foodName.toLowerCase());
    if (customIndex !== -1) {
      customFoods[customIndex].isHighlighted = !isCurrentlyHighlighted;
    }
  });

  localStorage.setItem("customFoods", JSON.stringify(customFoods));
});

// Render Total Daily Formula Scoops
function renderFormulaCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  if (!grid) return;
  grid.innerHTML = "";

  const [activeYearStr, activeMonthStr] = (window.activeCalendarMonth || new Date().toISOString().slice(0, 7)).split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} Formula Intake Calendar`;
  }

  // Calculate daily totals across all logs on the same date
  const dailyTotals = {};
  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    // Support both formulaHydration and legacy formula keys
    const formulaEntries = logData.formulaHydration || logData.formula || [];
    
    let totalScoops = 0;
    formulaEntries.forEach(f => {
      // Handle both object format { amount: 12 } and direct numbers
      const scoops = typeof f === "object" ? parseFloat(f.amount || f.scoops || 0) : parseFloat(f || 0);
      totalScoops += isNaN(scoops) ? 0 : scoops;
    });

    if (totalScoops > 0) {
      dailyTotals[logDate] = (dailyTotals[logDate] || 0) + totalScoops;
    }
  });

  renderSummaryCalendarGrid(grid, activeYear, activeMonthIndex, dailyTotals, "scoops", "#e54363");
}

// Render Total Daily Water Cups
function renderWaterCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  if (!grid) return;
  grid.innerHTML = "";

  const [activeYearStr, activeMonthStr] = (window.activeCalendarMonth || new Date().toISOString().slice(0,7)).split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} Water Intake Calendar`;
  }

  // Calculate daily totals
  const dailyTotals = {};
  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    // Count recorded cups/water entries
    const waterEntries = logData.warmWater || logData.water || [];
    const totalCups = calculateWaterCups(logData.warmWater || logData.water);

    if (totalCups > 0) {
      dailyTotals[logDate] = (dailyTotals[logDate] || 0) + totalCups;
    }
  });

  renderSummaryCalendarGrid(grid, activeYear, activeMonthIndex, dailyTotals, "cups", "#1abc9c");
}

// Helper to render unified totals grid
function renderSummaryCalendarGrid(grid, activeYear, activeMonthIndex, dailyTotals, unitLabel, badgeColor) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const dayStrFormatted = String(d).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStrFormatted}`;
    const total = dailyTotals[fullDateKey];

    const cell = document.createElement("div");
    cell.style.cssText = "border: 1px solid #e0e0e0; border-radius: 4px; padding: 4px 2px; min-height: 55px; background: #fff; display: flex; flex-direction: column; align-items: center;";

    const numSpan = document.createElement("span");
    numSpan.style.cssText = "font-weight: bold; font-size: 0.8rem; margin-bottom: 3px;";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    if (total > 0) {
      const badge = document.createElement("span");
      badge.style.cssText = `background-color: ${badgeColor}; color: #fff; border-radius: 3px; padding: 1px 4px; font-size: 0.65rem; font-weight: 600; white-space: nowrap;`;
      badge.innerText = `${total} ${unitLabel}`;
      cell.appendChild(badge);
    }

    grid.appendChild(cell);
  }
}

function renderMonthNavigation(startDate, endDate) {
  const navContainer = document.getElementById("calendar-month-nav");
  if (!navContainer || !startDate || !endDate) return;
  navContainer.innerHTML = "";

  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) monthsInRange.push(key);
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  // Ensure default active month is set
  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0] || new Date().toISOString().slice(0, 7);
  }

  if (monthsInRange.length <= 1) return;

  monthsInRange.forEach(mKey => {
    const [yStr, mStr] = mKey.split("-");
    const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerText = btnLabel;
    btn.style.cssText = "padding: 4px 10px; font-size: 0.8rem; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;";

    if (mKey === window.activeCalendarMonth) {
      btn.style.backgroundColor = "#2c3e50";
      btn.style.color = "#ffffff";
      btn.style.fontWeight = "bold";
    } else {
      btn.style.backgroundColor = "#ffffff";
      btn.style.color = "#333333";
    }

    btn.addEventListener("click", () => {
      window.activeCalendarMonth = mKey;
      renderAnalyticsChart();
    });

    navContainer.appendChild(btn);
  });
}

function renderMoodCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  const zoneColorMap = {
    "Blue Zone": "#3498db",
    "Green Zone": "#2ecc71",
    "Yellow Zone": "#f1c40f",
    "Red Zone": "#e74c3c"
  };

  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) monthsInRange.push(key);
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#2c3e50";
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
          window.activeCalendarMonth = mKey;
          renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} Mood Calendar`;
  }

  const dateItemsMap = {};

  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    const rawList = logData.moodLogs || logData.moods || logData.mood || [];
    const list = Array.isArray(rawList) ? rawList : [rawList];

    list.forEach(entry => {
      if (!entry) return;

      const zoneName = typeof entry === "object" ? (entry.zone || entry.label || "") : String(entry);
      if (!zoneName) return;

      let rawTime = typeof entry === "object" ? (entry.time || "") : "";
      if (!rawTime) rawTime = logData.time || "";

      let displayTime = rawTime;
      if (rawTime && rawTime.includes(":")) {
        const [h, m] = rawTime.split(":");
        let hours = parseInt(h, 10);
        const suffix = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        displayTime = `${hours}:${m} ${suffix}`;
      }

      const color = zoneColorMap[zoneName] || "#3498db";

      if (!dateItemsMap[logDate]) dateItemsMap[logDate] = [];
      dateItemsMap[logDate].push({
        label: zoneName,
        time: displayTime,
        color: color
      });
    });
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "4px 0";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStr}`;
    const entries = dateItemsMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.flexDirection = "column";
    badgeContainer.style.gap = "2px";
    badgeContainer.style.width = "100%";
    badgeContainer.style.alignItems = "center";

    entries.forEach(entry => {
      const badge = document.createElement("span");
      badge.style.backgroundColor = entry.color;
      badge.style.color = (entry.color === "#f1c40f") ? "#333" : "#fff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 3px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap";
      badge.innerText = entry.time ? entry.time : entry.label;
      badge.title = `${entry.label}${entry.time ? ' at ' + entry.time : ''}`;
      badgeContainer.appendChild(badge);
    });

    cell.appendChild(badgeContainer);
    grid.appendChild(cell);
  }
}

function renderBehaviorCalendar(startDate, endDate, records, colorMap = {}) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) monthsInRange.push(key);
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#2c3e50";
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
          window.activeCalendarMonth = mKey;
          renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} Behavior Calendar`;
  }

  const dateItemsMap = {};

  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    const rawList = logData.behaviorLogs || logData.behaviors || logData.behavior || [];
    const list = Array.isArray(rawList) ? rawList : [rawList];

    list.forEach(entry => {
      if (!entry) return;

      let rawLabel = typeof entry === "object" ? (entry.name || entry.label || entry.type || entry.behavior || "") : String(entry);
      rawLabel = rawLabel.trim();
      if (!rawLabel) return;

      const formattedLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

      let rawTime = typeof entry === "object" ? (entry.time || entry.logTime || "") : "";
      if (!rawTime) rawTime = logData.time || "";

      let displayTime = rawTime;
      if (rawTime && rawTime.includes(":")) {
        const [h, m] = rawTime.split(":");
        let hours = parseInt(h, 10);
        const suffix = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        displayTime = `${hours}:${m} ${suffix}`;
      }

      // Fallback to orange if color isn't in map
      const color = colorMap[formattedLabel] || "#e67e22";

      if (!dateItemsMap[logDate]) dateItemsMap[logDate] = [];
      dateItemsMap[logDate].push({
        label: formattedLabel,
        time: displayTime,
        color: color
      });
    });
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "4px 0";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStr}`;
    const entries = dateItemsMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.flexDirection = "column";
    badgeContainer.style.gap = "2px";
    badgeContainer.style.width = "100%";
    badgeContainer.style.alignItems = "center";

    entries.forEach(entry => {
      const badge = document.createElement("span");
      badge.style.backgroundColor = entry.color;
      badge.style.color = (entry.color === "#f1c40f") ? "#333" : "#fff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 3px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap";
      badge.innerText = entry.time ? entry.time : entry.label;
      badge.title = `${entry.label}${entry.time ? ' at ' + entry.time : ''}`;
      badgeContainer.appendChild(badge);
    });

    cell.appendChild(badgeContainer);
    grid.appendChild(cell);
  }
}

function renderDetailedItemCalendar(startDate, endDate, records, titleSuffix, extractorFn, defaultColor) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) {
      monthsInRange.push(key);
    }
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#2c3e50";
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
          window.activeCalendarMonth = mKey;
          renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} ${titleSuffix}`;
  }

  const dateItemsMap = {};

  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    const rawList = extractorFn(logData) || [];
    const list = Array.isArray(rawList) ? rawList : [rawList];

    list.forEach(entry => {
      if (!entry) return;

      let label = typeof entry === "object" ? (entry.name || entry.label || entry.type || entry.level || entry.mood || "") : String(entry);
      label = label.trim();
      if (!label) return;

      let rawTime = typeof entry === "object" ? (entry.time || entry.logTime || "") : "";
      if (!rawTime) rawTime = logData.time || "";

      let displayTime = rawTime;
      if (rawTime && rawTime.includes(":")) {
        const [h, m] = rawTime.split(":");
        let hours = parseInt(h, 10);
        const suffix = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        displayTime = `${hours}:${m} ${suffix}`;
      }

      if (!dateItemsMap[logDate]) dateItemsMap[logDate] = [];
      dateItemsMap[logDate].push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        time: displayTime,
        color: defaultColor
      });
    });
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "4px 0";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStr}`;
    const entries = dateItemsMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.flexDirection = "column";
    badgeContainer.style.gap = "2px";
    badgeContainer.style.width = "100%";
    badgeContainer.style.alignItems = "center";

    entries.forEach(entry => {
      const badge = document.createElement("span");
      badge.style.backgroundColor = entry.color;
      badge.style.color = (entry.color === "#f1c40f") ? "#333" : "#fff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 3px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap";
      badge.innerText = entry.time ? entry.time : entry.label;
      badge.title = `${entry.label}${entry.time ? ' at ' + entry.time : ''}`;
      badgeContainer.appendChild(badge);
    });

    cell.appendChild(badgeContainer);
    grid.appendChild(cell);
  }
}

function renderSummaryCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  // Extract all "YYYY-MM" months in the range
  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) {
      monthsInRange.push(key);
    }
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  // Render Month Navigation Buttons
  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#2c3e50";
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
          window.activeCalendarMonth = mKey;
          renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} Day Summary Calendar`;
  }

  // Group summary entries by date
  const dateSummaryMap = {};

  records.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate || !logDate.startsWith(window.activeCalendarMonth)) return;

    const rawVal = String(logData.daySummaryStatus || logData.daySummary || logData.summary || "").toLowerCase();
    
    let label = "";
    let color = "";

    if (rawVal.includes("very good")) { label = "Very Good"; color = "#2ecc71"; }
    else if (rawVal.includes("very difficult")) { label = "Very Difficult"; color = "#e74c3c"; }
    else if (rawVal.includes("good")) { label = "Good"; color = "#3498db"; }
    else if (rawVal.includes("ok")) { label = "OK"; color = "#f1c40f"; }
    else if (rawVal.includes("difficult")) { label = "Difficult"; color = "#e67e22"; }

    if (label) {
      if (!dateSummaryMap[logDate]) dateSummaryMap[logDate] = [];
      dateSummaryMap[logDate].push({ label, color });
    }
  });

  // Days Header
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "4px 0";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, '0');
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStr}`;
    const entries = dateSummaryMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.flexDirection = "column";
    badgeContainer.style.gap = "2px";
    badgeContainer.style.width = "100%";
    badgeContainer.style.alignItems = "center";

    entries.forEach(entry => {
      const badge = document.createElement("span");
      badge.style.backgroundColor = entry.color;
      badge.style.color = (entry.color === "#f1c40f") ? "#333" : "#fff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 4px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap";
      badge.innerText = entry.label;
      badgeContainer.appendChild(badge);
    });

    cell.appendChild(badgeContainer);
    grid.appendChild(cell);
  }
}

function renderFirstFoodCalendar(startDate, endDate, records) {
  const grid = document.getElementById("calendar-grid");
  const titleHeader = document.getElementById("calendar-title");
  const navContainer = document.getElementById("calendar-month-nav");
  if (!grid) return;
  grid.innerHTML = "";

  if (!startDate || !endDate) return;

  // Retrieve saved custom foods to check highlight status
  const customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");
  const highlightedNames = new Set(
    customFoods
      .filter(f => f.isHighlighted === true)
      .map(f => f.name.toLowerCase().trim())
  );

  const firstFoodDates = {};

  const sortedRecords = [...records].sort((a, b) => {
    const dateA = (a.data || a).date || "";
    const dateB = (b.data || b).date || "";
    return dateA.localeCompare(dateB);
  });

  sortedRecords.forEach(item => {
    const logData = item.data || item;
    const logDate = logData.date;
    if (!logDate) return;
  
    const foods = logData.foods || logData.foodData || [];
    const foodList = Array.isArray(foods) ? foods : [foods];
  
    foodList.forEach(f => {
      if (!f) return;
  
      let foodName = "";
      let isHighlighted = false;
  
      if (typeof f === "object") {
        foodName = f.name || f.food || f.label || "";
        isHighlighted = f.isHighlighted === true;
      } else {
        foodName = String(f);
      }
  
      foodName = foodName.trim();
      if (!foodName) return;
  
      // Cross-reference with localStorage customFoods as a fallback
      const customFoods = JSON.parse(localStorage.getItem("customFoods") || "[]");
      const matchingCustom = customFoods.find(cf => cf.name.toLowerCase() === foodName.toLowerCase());
      const isNew = isHighlighted || (matchingCustom && matchingCustom.isHighlighted === true);
  
      // Only place on the calendar if the food is flagged as a new introduction
      if (isNew) {
        const formattedName = foodName.charAt(0).toUpperCase() + foodName.slice(1);
        
        // Store ONLY the earliest date this highlighted food was logged
        if (!firstFoodDates[formattedName]) {
          firstFoodDates[formattedName] = logDate;
        }
      }
    });
  });

  // Build month range for navigation
  const monthsInRange = [];
  let curr = new Date(startDate + "T00:00:00");
  const last = new Date(endDate + "T00:00:00");

  while (curr <= last) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    if (!monthsInRange.includes(key)) monthsInRange.push(key);
    curr.setMonth(curr.getMonth() + 1);
    curr.setDate(1);
  }

  if (!window.activeCalendarMonth || !monthsInRange.includes(window.activeCalendarMonth)) {
    window.activeCalendarMonth = monthsInRange[0];
  }

  const [activeYearStr, activeMonthStr] = window.activeCalendarMonth.split("-");
  const activeYear = parseInt(activeYearStr, 10);
  const activeMonthIndex = parseInt(activeMonthStr, 10) - 1;

  // Month Navigation Buttons
  if (navContainer) {
    navContainer.innerHTML = "";
    if (monthsInRange.length > 1) {
      monthsInRange.forEach(mKey => {
        const [yStr, mStr] = mKey.split("-");
        const mDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const btnLabel = mDate.toLocaleString("default", { month: "short", year: "numeric" });

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerText = btnLabel;
        btn.style.padding = "4px 10px";
        btn.style.fontSize = "0.8rem";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid #ccc";
        btn.style.cursor = "pointer";

        if (mKey === window.activeCalendarMonth) {
          btn.style.backgroundColor = "#2c3e50";
          btn.style.color = "#ffffff";
          btn.style.fontWeight = "bold";
        } else {
          btn.style.backgroundColor = "#ffffff";
          btn.style.color = "#333333";
        }

        btn.addEventListener("click", () => {
          window.activeCalendarMonth = mKey;
          renderAnalyticsChart();
        });

        navContainer.appendChild(btn);
      });
    }
  }

  if (titleHeader) {
    const monthName = new Date(activeYear, activeMonthIndex, 1).toLocaleString("default", { month: "long" });
    titleHeader.innerText = `${monthName} ${activeYear} First Food Introductions`;
  }

  // Map active month introductions
  const dateIntroductionsMap = {};
  const palette = ["#27ae60", "#2980b9", "#8e44ad", "#d35400", "#16a085", "#c0392b"];
  const allFoods = Object.keys(firstFoodDates).sort();

  allFoods.forEach((food, idx) => {
    const introDate = firstFoodDates[food];
    if (introDate && introDate.startsWith(window.activeCalendarMonth)) {
      if (!dateIntroductionsMap[introDate]) dateIntroductionsMap[introDate] = [];
      dateIntroductionsMap[introDate].push({
        name: food,
        color: palette[idx % palette.length]
      });
    }
  });

  // Calendar Header Days
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(day => {
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "4px 0";
    header.innerText = day;
    grid.appendChild(header);
  });

  const firstDayIndex = new Date(activeYear, activeMonthIndex, 1).getDay();
  const totalDays = new Date(activeYear, activeMonthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.appendChild(document.createElement("div"));
  }

  // Render Days
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, "0");
    const monthStrFormatted = String(activeMonthIndex + 1).padStart(2, "0");
    const fullDateKey = `${activeYear}-${monthStrFormatted}-${dayStr}`;
    const introducedFoods = dateIntroductionsMap[fullDateKey] || [];

    const cell = document.createElement("div");
    cell.style.border = "1px solid #e0e0e0";
    cell.style.borderRadius = "4px";
    cell.style.padding = "4px 2px";
    cell.style.minHeight = "55px";
    cell.style.backgroundColor = "#ffffff";
    cell.style.display = "flex";
    cell.style.flexDirection = "column";
    cell.style.alignItems = "center";

    const numSpan = document.createElement("span");
    numSpan.style.fontWeight = "bold";
    numSpan.style.fontSize = "0.8rem";
    numSpan.style.marginBottom = "3px";
    numSpan.innerText = d;
    cell.appendChild(numSpan);

    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.flexDirection = "column";
    badgeContainer.style.gap = "2px";
    badgeContainer.style.width = "100%";
    badgeContainer.style.alignItems = "center";

    introducedFoods.forEach(item => {
      const badge = document.createElement("span");
      badge.style.backgroundColor = item.color;
      badge.style.color = "#ffffff";
      badge.style.borderRadius = "3px";
      badge.style.padding = "1px 4px";
      badge.style.fontSize = "0.65rem";
      badge.style.fontWeight = "600";
      badge.style.whiteSpace = "nowrap";
      badge.style.overflow = "hidden";
      badge.style.textOverflow = "ellipsis";
      badge.style.maxWidth = "90%";
      badge.innerText = item.name;
      badge.title = `Introduced on ${fullDateKey}: ${item.name}`;
      badgeContainer.appendChild(badge);
    });

    cell.appendChild(badgeContainer);
    grid.appendChild(cell);
  }
}

// Fetch goal from the user's subcollection
export async function getGoal(type) {
  const defaults = { formula: 80, water: 8 };
  const user = auth.currentUser;

  if (!user) return defaults[type];

  try {
    const goalDocRef = doc(db, "users", user.uid, "logs", "goal_settings");
    const docSnap = await getDoc(goalDocRef);

    if (docSnap.exists() && docSnap.data()?.[type] !== undefined) {
      return parseFloat(docSnap.data()[type]);
    }
  } catch (err) {
    console.error("Error fetching goal:", err);
  }

  return defaults[type];
}

// Save goal to the user's subcollection
export async function saveGoalToFirebase(type) {
  const input = document.getElementById(`${type}-goal-input`);
  if (!input) return;

  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) {
    alert("Please enter a valid positive goal number.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in to update goals.");
    return;
  }

  try {
    const goalDocRef = doc(db, "users", user.uid, "logs", "goal_settings");
    
    await setDoc(goalDocRef, {
      [type]: val,
      updatedAt: new Date()
    }, { merge: true });

    // Clear input
    input.value = "";

    // Re-render chart instantly
    if (typeof renderAnalyticsChart === "function") {
      await renderAnalyticsChart();
    }

    // Trigger alert
    const label = type === "formula" ? "Formula" : "Water";
    alert(`${label} Goal saved successfully!`);

  } catch (error) {
    console.error("Error saving goal:", error);
    alert("Failed to save goal.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const formulaBtn = document.getElementById("set-formula-goal-btn");
  const waterBtn = document.getElementById("set-water-goal-btn");

  if (formulaBtn) {
    formulaBtn.addEventListener("click", () => saveGoalToFirebase("formula"));
  }

  if (waterBtn) {
    waterBtn.addEventListener("click", () => saveGoalToFirebase("water"));
  }
});













  document.getElementById("clear-all-records-btn")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete ALL logged records?")) {
      localStorage.removeItem("careRecords"); // Adjust key to match your localStorage key
      window.allRecords = [];
      if (typeof allPastRecords !== "undefined") allPastRecords = [];
      
      // Refresh views
      if (typeof applySearchAndFilter === "function") applySearchAndFilter();
      if (typeof renderAnalyticsChart === "function") renderAnalyticsChart();
      
      alert("All records cleared successfully.");
    }
  });


