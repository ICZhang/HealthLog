import { auth, db } from "./firebase-config.js";
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global Variables
let currentUser = null;
let unsubscribeLogs = null;

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
const medsContainer = document.getElementById("meds-container");
const formulaContainer = document.getElementById("formula-container");
const activitiesContainer = document.getElementById("activities-container");

// Add Row Buttons
const addBmBtn = document.getElementById("add-bm-btn");
const addMedBtn = document.getElementById("add-med-btn");
const addFormulaBtn = document.getElementById("add-formula-btn");
const addActivityBtn = document.getElementById("add-activity-btn");

// Authentication State Tracker
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userEmailEl.textContent = user.email;
    document.getElementById("dashboard").classList.remove("hidden");
    document.getElementById("auth-card")?.classList.add("hidden");
    
    // Set default date to today and time to now
    resetForm();
    
    // Listen for live Firestore updates
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

// --- DYNAMIC ROW GENERATION ---

// Helper to create BM Row
function addBmRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row bm-row";
  row.style.cssText = "border: 1px solid #eee; padding: 8px; border-radius: 6px; margin-bottom: 8px; background: #fafafa;";
  row.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 6px;">
      <input type="time" class="bm-time" value="${data.time || ''}" style="flex: 1;" />
      <select class="bm-type" style="flex: 2;">
        <option value="">-- Bristol Type (1-7) --</option>
        ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${data.type == n ? 'selected' : ''}>Type ${n}</option>`).join('')}
      </select>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <span style="font-size: 0.85rem; font-weight: bold;">Amount:</span>
      <label style="margin:0;"><input type="radio" name="bm-amt-${Date.now()}-${Math.random()}" value="S" ${data.amount === 'S' ? 'checked' : ''}> S</label>
      <label style="margin:0;"><input type="radio" name="bm-amt-${Date.now()}-${Math.random()}" value="M" ${data.amount === 'M' ? 'checked' : ''}> M</label>
      <label style="margin:0;"><input type="radio" name="bm-amt-${Date.now()}-${Math.random()}" value="L" ${data.amount === 'L' ? 'checked' : ''}> L</label>
      <input type="text" class="bm-color" placeholder="Color" value="${data.color || ''}" style="flex: 1; margin:0;" />
      <button type="button" class="remove-row-btn" style="background: #e74c3c; width: auto; padding: 4px 8px; font-size: 0.8rem; margin:0;">X</button>
    </div>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  bmContainer.appendChild(row);
}

// Helper to create Generic Single-Field Row
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

// Add Row Button Event Listeners
addBmBtn.addEventListener("click", () => addBmRow());
addMedBtn.addEventListener("click", () => addTextRow(medsContainer, "med-row", "Cromolyn / Med Dose (Time / Notes)"));
addFormulaBtn.addEventListener("click", () => addTextRow(formulaContainer, "formula-row", "Formula / Hydration Entry"));
addActivityBtn.addEventListener("click", () => addTextRow(activitiesContainer, "activity-row", "Activity Details"));

// Reset Form to Initial State (2 rows per section)
function resetForm() {
  logForm.reset();
  editingDocIdInput.value = "";
  saveLogBtn.textContent = "Save Care Log";
  cancelEditBtn.classList.add("hidden");

  // Set today's date & current time
  const now = new Date();
  document.getElementById("log-date").value = now.toISOString().split("T")[0];
  document.getElementById("log-time").value = now.toTimeString().slice(0, 5);

  // Clear containers
  bmContainer.innerHTML = "";
  medsContainer.innerHTML = "";
  formulaContainer.innerHTML = "";
  activitiesContainer.innerHTML = "";

  // Render 2 initial rows for each section
  addBmRow(); addBmRow();
  addTextRow(medsContainer, "med-row", "1st Med Dose (Time / Notes)");
  addTextRow(medsContainer, "med-row", "2nd Med Dose (Time / Notes)");
  addTextRow(formulaContainer, "formula-row", "1st Formula/Hydration Entry");
  addTextRow(formulaContainer, "formula-row", "2nd Formula/Hydration Entry");
  addTextRow(activitiesContainer, "activity-row", "#1 Activity");
  addTextRow(activitiesContainer, "activity-row", "#2 Activity");
}

cancelEditBtn.addEventListener("click", resetForm);

// --- EXTRACT FORM DATA ---
function getFormData() {
  // BM Entries
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

  // Dynamic Text Inputs Helper
  const getValues = (selector) => {
    const vals = [];
    document.querySelectorAll(selector).forEach(row => {
      const val = row.querySelector(".row-input").value.trim();
      if (val) vals.push(val);
    });
    return vals;
  };

  // Foods & Amounts
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

  return {
    date: document.getElementById("log-date").value,
    time: document.getElementById("log-time").value,
    bowelMovements: bmData,
    medications: getValues(".med-row"),
    herbalMedsTime: document.getElementById("herbal-meds-time").value,
    enteragram: document.getElementById("enteragram").value,
    formulaHydration: getValues(".formula-row"),
    warmWater: {
      cups: document.getElementById("warm-water-cups").value,
      time: document.getElementById("warm-water-time").value
    },
    activities: getValues(".activity-row"),
    enzymes: {
      noFenol: { checked: document.getElementById("enzyme-no-fenol").checked, notes: document.getElementById("enzyme-no-fenol-notes").value },
      carbDgts: { checked: document.getElementById("enzyme-carb-dgts").checked, notes: document.getElementById("enzyme-carb-dgts-notes").value },
      chew: { checked: document.getElementById("enzyme-chew").checked, notes: document.getElementById("enzyme-chew-notes").value }
    },
    foods: foodData,
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
      // Update Existing Doc
      await setDoc(doc(db, "users", currentUser.uid, "logs", editingId), logData, { merge: true });
      alert("Care Log updated successfully!");
    } else {
      // Create New Doc
      await addDoc(collection(db, "users", currentUser.uid, "logs"), logData);
      alert("Care Log saved successfully!");
    }
    resetForm();
  } catch (err) {
    console.error("Error saving record: ", err);
    alert("Error saving record. Please try again.");
  }
});

// --- LOAD PAST RECORDS ---
function loadPastRecords(userId) {
  const q = query(collection(db, "users", userId, "logs"), orderBy("date", "desc"));
  
  unsubscribeLogs = onSnapshot(q, (snapshot) => {
    logList.innerHTML = "";
    if (snapshot.empty) {
      logList.innerHTML = `<li style="color: #888;">No saved care records found.</li>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      const li = document.createElement("li");
      li.style.cssText = "background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 10px; list-style: none;";
      
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>📅 ${data.date} at ${data.time || 'N/A'}</strong>
          <button type="button" class="edit-log-btn" style="width: auto; padding: 4px 10px; font-size: 0.8rem; margin:0; background: #4A90E2;">Edit</button>
        </div>
        <p style="margin: 6px 0; font-size: 0.9rem; color: #444;">
          <strong>BMs:</strong> ${data.bowelMovements ? data.bowelMovements.length : 0} logged | 
          <strong>Warm Water:</strong> ${data.warmWater?.cups || 0} cups
        </p>
        ${data.notes ? `<p style="margin: 4px 0; font-size: 0.85rem; color: #666; font-style: italic;">"${data.notes.slice(0, 60)}..."</p>` : ''}
      `;

      // Edit Button Action
      li.querySelector(".edit-log-btn").addEventListener("click", () => {
        populateFormForEdit(docId, data);
      });

      logList.appendChild(li);
    });
  });
}

// Populate Form for Editing
function populateFormForEdit(id, data) {
  editingDocIdInput.value = id;
  saveLogBtn.textContent = "Update Care Log";
  cancelEditBtn.classList.remove("hidden");

  // Basic Info
  document.getElementById("log-date").value = data.date || "";
  document.getElementById("log-time").value = data.time || "";

  // Bowel Movements
  bmContainer.innerHTML = "";
  if (data.bowelMovements && data.bowelMovements.length > 0) {
    data.bowelMovements.forEach(bm => addBmRow(bm));
  } else {
    addBmRow();
  }

  // Meds
  medsContainer.innerHTML = "";
  if (data.medications && data.medications.length > 0) {
    data.medications.forEach(m => addTextRow(medsContainer, "med-row", "Med Dose", m));
  } else {
    addTextRow(medsContainer, "med-row", "Med Dose");
  }

  document.getElementById("herbal-meds-time").value = data.herbalMedsTime || "";
  document.getElementById("enteragram").value = data.enteragram || "";

  // Formula
  formulaContainer.innerHTML = "";
  if (data.formulaHydration && data.formulaHydration.length > 0) {
    data.formulaHydration.forEach(f => addTextRow(formulaContainer, "formula-row", "Formula Entry", f));
  } else {
    addTextRow(formulaContainer, "formula-row", "Formula Entry");
  }

  // Warm Water
  document.getElementById("warm-water-cups").value = data.warmWater?.cups || "";
  document.getElementById("warm-water-time").value = data.warmWater?.time || "";

  // Activities
  activitiesContainer.innerHTML = "";
  if (data.activities && data.activities.length > 0) {
    data.activities.forEach(a => addTextRow(activitiesContainer, "activity-row", "Activity Details", a));
  } else {
    addTextRow(activitiesContainer, "activity-row", "Activity Details");
  }

  // Enzymes
  if (data.enzymes) {
    document.getElementById("enzyme-no-fenol").checked = !!data.enzymes.noFenol?.checked;
    document.getElementById("enzyme-no-fenol-notes").value = data.enzymes.noFenol?.notes || "";
    document.getElementById("enzyme-carb-dgts").checked = !!data.enzymes.carbDgts?.checked;
    document.getElementById("enzyme-carb-dgts-notes").value = data.enzymes.carbDgts?.notes || "";
    document.getElementById("enzyme-chew").checked = !!data.enzymes.chew?.checked;
    document.getElementById("enzyme-chew-notes").value = data.enzymes.chew?.notes || "";
  }

  // Foods
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

  // Switch to New Entry tab for editing
  tabNewBtn.click();
}