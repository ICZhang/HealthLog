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
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
        <strong>📅 ${data.date} at ${data.time || 'N/A'}</strong>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="view-log-btn" style="width: auto; padding: 4px 8px; font-size: 0.8rem; margin:0; background: #2ecc71;">View</button>
          <button type="button" class="edit-log-btn" style="width: auto; padding: 4px 8px; font-size: 0.8rem; margin:0; background: #4A90E2;">Edit</button>
          <button type="button" class="delete-log-btn" style="width: auto; padding: 4px 8px; font-size: 0.8rem; margin:0; background: #e74c3c;">Delete</button>
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
  const searchTerm = document.getElementById("search-input").value.toLowerCase().trim();
  const filterDate = document.getElementById("filter-date-input").value;

  const filtered = allPastRecords.filter(({ data }) => {
    const matchesDate = !filterDate || data.date === filterDate;
    const notesMatch = data.notes?.toLowerCase().includes(searchTerm);
    const herbalMatch = data.herbalMeds?.some(h => h.name.toLowerCase().includes(searchTerm));
    const foodsMatch = data.foods?.some(f => f.name.toLowerCase().includes(searchTerm));
    
    const matchesSearch = !searchTerm || notesMatch || herbalMatch || foodsMatch;

    return matchesDate && matchesSearch;
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
    
    applySearchAndFilter();
  });
}

// Search and Filter Event Listeners
document.getElementById("search-input")?.addEventListener("input", applySearchAndFilter);
document.getElementById("filter-date-input")?.addEventListener("change", applySearchAndFilter);
document.getElementById("clear-filter-btn")?.addEventListener("click", () => {
  document.getElementById("search-input").value = "";
  document.getElementById("filter-date-input").value = "";
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
  
  document.getElementById("toggle-auth")?.addEventListener("click", handleAuthToggle);
}

document.getElementById("toggle-auth")?.addEventListener("click", handleAuthToggle);

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
tabNewBtn.addEventListener("click", () => {
  tabNewBtn.style.backgroundColor = "#4A90E2";
  tabPastBtn.style.backgroundColor = "#888";
  sectionNewEntry.classList.remove("hidden");
  sectionPastRecords.classList.add("hidden");
});

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
    <input type="text" class="row-input" placeholder="${placeholder}" value="${value}" style="flex: 1; margin: 0;" />
    <button type="button" class="remove-row-btn" style="background: #e74c3c; width: auto; padding: 4px 10px; font-size: 0.8rem; margin:0;">X</button>
  `;

  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

// Event Listeners for Adding Rows
addBmBtn?.addEventListener("click", () => addBmRow());
addFormulaBtn?.addEventListener("click", () => addTextRow(formulaContainer, "formula-row", "Formula / Hydration Entry"));
addActivityBtn?.addEventListener("click", () => addTextRow(activitiesContainer, "activity-row", "Activity Details"));
addWaterBtn?.addEventListener("click", () => addWaterRow());
addHerbalBtn?.addEventListener("click", () => addHerbalRow());
addEnteragramBtn?.addEventListener("click", () => addEnteragramRow());
addPainBtn?.addEventListener("click", () => addPainRow());
addMoodBtn?.addEventListener("click", () => addMoodRow());
addBehaviorBtn?.addEventListener("click", () => addBehaviorRow());

function resetForm() {
  logForm.reset();
  editingDocIdInput.value = "";
  saveLogBtn.textContent = "Save Care Log";
  cancelEditBtn.classList.add("hidden");

  const now = new Date();
  document.getElementById("log-date").value = now.toISOString().split("T")[0];
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

  addBmRow(); 
  addBmRow();
  addTextRow(formulaContainer, "formula-row", "1st Formula/Hydration Entry");
  addTextRow(formulaContainer, "formula-row", "2nd Formula/Hydration Entry");
  addTextRow(activitiesContainer, "activity-row", "#1 Activity");
  addTextRow(activitiesContainer, "activity-row", "#2 Activity");
  addWaterRow();
  addHerbalRow();     
  addEnteragramRow();
  addPainRow();
  addMoodRow();
  addBehaviorRow();
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
      const val = row.querySelector(".row-input").value.trim();
      if (val) vals.push(val);
    });
    return vals;
  };

  const waterData = [];
  document.querySelectorAll(".water-row").forEach(row => {
    const time = row.querySelector(".water-time").value;
    if (time) waterData.push({ time });
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

  const foodData = [];
  document.querySelectorAll("#foods-grid .food-row").forEach(row => {
    const checkbox = row.querySelector("input[type='checkbox']");
    const amountInput = row.querySelector("input[type='text']");
    if (checkbox.checked || amountInput.value.trim() !== "") {
      foodData.push({
        name: checkbox.value,
        checked: checkbox.checked,
        amount: amountInput.value.trim()
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

  return {
    date: document.getElementById("log-date").value,
    time: document.getElementById("log-time").value,
    bowelMovements: bmData,
    herbalMeds,
    enteragramDoses,
    formulaHydration: getValues(".formula-row"),
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
    notes: document.getElementById("day-notes").value,
    updatedAt: new Date()
  };
}

// --- SAVE / EDIT FIRESTORE LOG ---
logForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

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

  formulaContainer.innerHTML = "";
  if (data.formulaHydration && data.formulaHydration.length > 0) {
    data.formulaHydration.forEach(f => addTextRow(formulaContainer, "formula-row", "Formula Entry", f));
  } else {
    addTextRow(formulaContainer, "formula-row", "Formula Entry");
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

  document.querySelectorAll("#foods-grid .food-row").forEach(row => {
    const checkbox = row.querySelector("input[type='checkbox']");
    const amountInput = row.querySelector("input[type='text']");
    const savedFood = data.foods?.find(f => f.name === checkbox.value);

    if (savedFood) {
      checkbox.checked = savedFood.checked;
      amountInput.value = savedFood.amount || "";
    } else {
      checkbox.checked = false;
      amountInput.value = "";
    }
  });

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
    const predefined = ["Screaming", "Throwing", ""];
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
            <option value="Other">Other...</option>
          </select>
        `;
      }
    });
  
    row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
    behaviorContainer.appendChild(row);
  }

// Render read-only record details
function showViewModal(data) {
  const modal = document.getElementById("view-modal");
  const modalBody = document.getElementById("view-modal-body");

  modalBody.innerHTML = `
    <h3 style="margin-top: 0; color: #333;">Care Log - ${data.date} (${data.time || 'N/A'})</h3>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;" />
    
    <p><strong>Bowel Movements:</strong></p>
    <ul>
      ${data.bowelMovements?.length 
        ? data.bowelMovements.map(bm => `<li>Time: ${bm.time || 'N/A'} | Type: ${bm.type || 'N/A'} | Amount: ${bm.amount || 'N/A'} | Color: ${bm.color || 'N/A'}</li>`).join('')
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Warm Water Log:</strong></p>
    <ul>
      ${Array.isArray(data.warmWater) && data.warmWater.length 
        ? data.warmWater.map((w, idx) => `<li>Cup ${idx + 1}: at ${w.time || 'N/A'}</li>`).join('')
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Herbal Meds:</strong></p>
    <ul>
      ${data.herbalMeds?.length 
        ? data.herbalMeds.map(h => `<li>${h.name || 'Unnamed'}: at ${h.time || 'N/A'}</li>`).join('') 
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Enteragram:</strong></p>
    <ul>
      ${data.enteragramDoses?.length 
        ? data.enteragramDoses.map(e => `<li>Dose: ${e.dose || 'N/A'} at ${e.time || 'N/A'}</li>`).join('') 
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Formula / Hydration:</strong></p>
    <ul>
      ${data.formulaHydration?.length ? data.formulaHydration.map(f => `<li>${f}</li>`).join('') : '<li>None recorded</li>'}
    </ul>

    <p><strong>Activities:</strong></p>
    <ul>
      ${data.activities?.length ? data.activities.map(a => `<li>${a}</li>`).join('') : '<li>None recorded</li>'}
    </ul>

    <p><strong>Foods:</strong></p>
    <ul>
      ${data.foods?.length ? data.foods.map(f => `<li>${f.name}: ${f.amount || 'Checked'}</li>`).join('') : '<li>None recorded</li>'}
    </ul>

    <p><strong>Pain Logs:</strong></p>
    <ul>
    ${data.painLogs?.length 
        ? data.painLogs.map(p => `<li>${p.level || 'Unspecified'}: at ${p.time || 'N/A'}</li>`).join('') 
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Mood Logs:</strong></p>
    <ul>
    ${data.moodLogs?.length 
        ? data.moodLogs.map(m => `<li>${m.zone || 'Unspecified'}: at ${m.time || 'N/A'}</li>`).join('') 
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Behavior Logs:</strong></p>
    <ul>
    ${data.behaviorLogs?.length 
        ? data.behaviorLogs.map(b => `<li>${b.type || 'Unspecified'}: at ${b.time || 'N/A'}</li>`).join('') 
        : '<li>None recorded</li>'}
    </ul>

    <p><strong>Notes:</strong> ${data.notes || 'No extra notes.'}</p>
  `;

  modal.classList.remove("hidden");
}

// Close Modal Event Handler
document.getElementById("close-modal-btn")?.addEventListener("click", () => {
  document.getElementById("view-modal").classList.add("hidden");
});