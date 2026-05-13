// ================= PROMPTS MODULE =================

const PROMPTS_STORAGE_KEY = "tools.prompts.items";
const PROMPT_CATEGORIES = [
  "windsurf",
  "codex",
  "debug",
  "deploy",
  "firestore",
  "ui",
  "refactor",
  "hotfix"
];

let promptItems = [];
let currentPromptItem = null;

function openPrompts() {
  createWindow("Prompt Library", `
    <div class="window-content">
      <div class="sidebar">
        <button onclick="createPromptItem()">+ Ny Prompt</button>
        <input id="promptSearch" placeholder="Søg..." oninput="renderPromptList()">
        
        <select id="promptCategoryFilter" onchange="renderPromptList()">
          <option value="">Alle kategorier</option>
          ${PROMPT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
        </select>
        
        <div id="promptList" style="margin-top: 10px;"></div>
        
        <hr>
        <button onclick="exportPromptJson()">Export JSON</button>
        <button onclick="importPromptJson()">Import JSON</button>
      </div>
      
      <div class="main">
        <div id="promptEditor" style="display: none;">
          <input id="promptTitle" placeholder="Titel">
          
          <select id="promptCategory">
            <option value="">Vælg kategori</option>
            ${PROMPT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
          </select>
          
          <input id="promptTags" placeholder="Tags (komma-separeret)">
          
          <textarea id="promptContent" placeholder="Prompt indhold..."></textarea>
          
          <div class="row">
            <button onclick="savePromptItem()">Gem</button>
            <button onclick="copyPromptContent()" class="secondary">Kopiér</button>
            <button onclick="deletePromptItem()" class="danger">Slet</button>
          </div>
        </div>
        
        <div id="promptEmpty" style="padding: 20px; text-align: center; color: #999;">
          Vælg eller opret en prompt
        </div>
      </div>
    </div>
  `);
  
  loadPromptItems();
}

function loadPromptItems() {
  try {
    const raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
    promptItems = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("[loadPromptItems]", error);
    promptItems = [];
  }
  
  renderPromptList();
}

function savePromptItems() {
  localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(promptItems, null, 2));
}

function renderPromptList() {
  const list = document.getElementById("promptList");
  if (!list) return;
  
  const search = (getValue("promptSearch") || "").toLowerCase();
  const categoryFilter = getValue("promptCategoryFilter");
  
  const filtered = promptItems.filter(item => {
    const matchesSearch = !search || 
      item.title.toLowerCase().includes(search) ||
      item.content.toLowerCase().includes(search) ||
      (item.tags || []).some(tag => tag.toLowerCase().includes(search));
    
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  list.innerHTML = filtered.map(item => `
    <button onclick="selectPromptItem('${item.id}')" style="text-align: left; font-size: 13px;">
      <strong>${escapeHtml(item.title || "Uden titel")}</strong><br>
      <span class="muted">${escapeHtml(item.category || "")}</span>
    </button>
  `).join("");
}

function createPromptItem() {
  currentPromptItem = {
    id: Date.now().toString(),
    title: "",
    category: "",
    content: "",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  showPromptEditor();
}

function selectPromptItem(id) {
  currentPromptItem = promptItems.find(item => item.id === id);
  if (!currentPromptItem) return;
  
  showPromptEditor();
}

function showPromptEditor() {
  const editor = document.getElementById("promptEditor");
  const empty = document.getElementById("promptEmpty");
  
  if (editor) editor.style.display = "block";
  if (empty) empty.style.display = "none";
  
  const titleEl = document.getElementById("promptTitle");
  const categoryEl = document.getElementById("promptCategory");
  const tagsEl = document.getElementById("promptTags");
  const contentEl = document.getElementById("promptContent");
  
  if (titleEl) titleEl.value = currentPromptItem.title || "";
  if (categoryEl) categoryEl.value = currentPromptItem.category || "";
  if (tagsEl) tagsEl.value = (currentPromptItem.tags || []).join(", ");
  if (contentEl) contentEl.value = currentPromptItem.content || "";
}

function savePromptItem() {
  if (!currentPromptItem) return;
  
  currentPromptItem.title = getValue("promptTitle");
  currentPromptItem.category = getValue("promptCategory");
  currentPromptItem.tags = getValue("promptTags").split(",").map(t => t.trim()).filter(Boolean);
  currentPromptItem.content = getValue("promptContent");
  currentPromptItem.updatedAt = new Date().toISOString();
  
  const existingIndex = promptItems.findIndex(item => item.id === currentPromptItem.id);
  
  if (existingIndex >= 0) {
    promptItems[existingIndex] = currentPromptItem;
  } else {
    promptItems.push(currentPromptItem);
  }
  
  savePromptItems();
  renderPromptList();
  alert("Prompt gemt");
}

function deletePromptItem() {
  if (!currentPromptItem) return;
  if (!confirm("Slet denne prompt?")) return;
  
  promptItems = promptItems.filter(item => item.id !== currentPromptItem.id);
  savePromptItems();
  renderPromptList();
  
  currentPromptItem = null;
  const editor = document.getElementById("promptEditor");
  const empty = document.getElementById("promptEmpty");
  if (editor) editor.style.display = "none";
  if (empty) empty.style.display = "block";
}

function copyPromptContent() {
  const content = getValue("promptContent");
  navigator.clipboard.writeText(content);
  alert("Prompt kopieret");
}

function exportPromptJson() {
  const json = JSON.stringify(promptItems, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prompts-export-" + Date.now() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importPromptJson() {
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
        
        promptItems = [...promptItems, ...imported];
        savePromptItems();
        renderPromptList();
        alert("Importeret " + imported.length + " prompts");
      } catch (error) {
        alert("Import fejlede: " + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}
