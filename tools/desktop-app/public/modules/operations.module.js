// ================= OPERATIONS MODULE =================

const OPERATIONS_STORAGE_KEY = "tools.operations.items";
const OPERATION_CATEGORIES = [
  "cvr-import",
  "backup",
  "deploy",
  "release",
  "support",
  "logs",
  "qa-checklist"
];

let operationItems = [];
let currentOperationItem = null;

function openOperations() {
  createWindow("Operations", `
    <div class="window-content">
      <div class="sidebar">
        <button onclick="createOperationItem()">+ Ny Task</button>
        <input id="operationSearch" placeholder="Søg..." oninput="renderOperationList()">
        
        <select id="operationCategoryFilter" onchange="renderOperationList()">
          <option value="">Alle kategorier</option>
          ${OPERATION_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
        </select>
        
        <div id="operationList" style="margin-top: 10px;"></div>
        
        <hr>
        <button onclick="exportOperationJson()">Export JSON</button>
        <button onclick="importOperationJson()">Import JSON</button>
      </div>
      
      <div class="main">
        <div id="operationEditor" style="display: none;">
          <input id="operationTitle" placeholder="Titel">
          
          <select id="operationCategory">
            <option value="">Vælg kategori</option>
            ${OPERATION_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
          </select>
          
          <input id="operationTags" placeholder="Tags (komma-separeret)">
          
          <textarea id="operationContent" placeholder="Procedure/checklist..."></textarea>
          
          <div class="row">
            <button onclick="saveOperationItem()">Gem</button>
            <button onclick="copyOperationContent()" class="secondary">Kopiér</button>
            <button onclick="deleteOperationItem()" class="danger">Slet</button>
          </div>
        </div>
        
        <div id="operationEmpty" style="padding: 20px; text-align: center; color: #999;">
          Vælg eller opret en operation
        </div>
      </div>
    </div>
  `);
  
  loadOperationItems();
}

function loadOperationItems() {
  try {
    const raw = localStorage.getItem(OPERATIONS_STORAGE_KEY);
    operationItems = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("[loadOperationItems]", error);
    operationItems = [];
  }
  
  renderOperationList();
}

function saveOperationItems() {
  localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(operationItems, null, 2));
}

function renderOperationList() {
  const list = document.getElementById("operationList");
  if (!list) return;
  
  const search = (getValue("operationSearch") || "").toLowerCase();
  const categoryFilter = getValue("operationCategoryFilter");
  
  const filtered = operationItems.filter(item => {
    const matchesSearch = !search || 
      item.title.toLowerCase().includes(search) ||
      item.content.toLowerCase().includes(search) ||
      (item.tags || []).some(tag => tag.toLowerCase().includes(search));
    
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  list.innerHTML = filtered.map(item => `
    <button onclick="selectOperationItem('${item.id}')" style="text-align: left; font-size: 13px;">
      <strong>${escapeHtml(item.title || "Uden titel")}</strong><br>
      <span class="muted">${escapeHtml(item.category || "")}</span>
    </button>
  `).join("");
}

function createOperationItem() {
  currentOperationItem = {
    id: Date.now().toString(),
    title: "",
    category: "",
    content: "",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  showOperationEditor();
}

function selectOperationItem(id) {
  currentOperationItem = operationItems.find(item => item.id === id);
  if (!currentOperationItem) return;
  
  showOperationEditor();
}

function showOperationEditor() {
  const editor = document.getElementById("operationEditor");
  const empty = document.getElementById("operationEmpty");
  
  if (editor) editor.style.display = "block";
  if (empty) empty.style.display = "none";
  
  const titleEl = document.getElementById("operationTitle");
  const categoryEl = document.getElementById("operationCategory");
  const tagsEl = document.getElementById("operationTags");
  const contentEl = document.getElementById("operationContent");
  
  if (titleEl) titleEl.value = currentOperationItem.title || "";
  if (categoryEl) categoryEl.value = currentOperationItem.category || "";
  if (tagsEl) tagsEl.value = (currentOperationItem.tags || []).join(", ");
  if (contentEl) contentEl.value = currentOperationItem.content || "";
}

function saveOperationItem() {
  if (!currentOperationItem) return;
  
  currentOperationItem.title = getValue("operationTitle");
  currentOperationItem.category = getValue("operationCategory");
  currentOperationItem.tags = getValue("operationTags").split(",").map(t => t.trim()).filter(Boolean);
  currentOperationItem.content = getValue("operationContent");
  currentOperationItem.updatedAt = new Date().toISOString();
  
  const existingIndex = operationItems.findIndex(item => item.id === currentOperationItem.id);
  
  if (existingIndex >= 0) {
    operationItems[existingIndex] = currentOperationItem;
  } else {
    operationItems.push(currentOperationItem);
  }
  
  saveOperationItems();
  renderOperationList();
  alert("Operation gemt");
}

function deleteOperationItem() {
  if (!currentOperationItem) return;
  if (!confirm("Slet denne operation?")) return;
  
  operationItems = operationItems.filter(item => item.id !== currentOperationItem.id);
  saveOperationItems();
  renderOperationList();
  
  currentOperationItem = null;
  const editor = document.getElementById("operationEditor");
  const empty = document.getElementById("operationEmpty");
  if (editor) editor.style.display = "none";
  if (empty) empty.style.display = "block";
}

function copyOperationContent() {
  const content = getValue("operationContent");
  navigator.clipboard.writeText(content);
  alert("Operation kopieret");
}

function exportOperationJson() {
  const json = JSON.stringify(operationItems, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "operations-export-" + Date.now() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importOperationJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error("JSON skal være et array");
        
        operationItems = [...operationItems, ...imported];
        saveOperationItems();
        renderOperationList();
        alert("Importeret " + imported.length + " operations");
      } catch (error) {
        alert("Import fejlede: " + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}
