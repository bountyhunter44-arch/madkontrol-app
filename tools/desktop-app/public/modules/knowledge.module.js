// ================= KNOWLEDGE MODULE =================

const KNOWLEDGE_STORAGE_KEY = "tools.knowledge.items";
const KNOWLEDGE_CATEGORIES = [
  "madkontrollen",
  "lexivoice",
  "firebase",
  "architecture",
  "bugs",
  "decisions",
  "do-not-change"
];

let knowledgeItems = [];
let currentKnowledgeItem = null;

function openKnowledge() {
  createWindow("Knowledge Base", `
    <div class="window-content">
      <div class="sidebar">
        <button onclick="createKnowledgeItem()">+ Ny Note</button>
        <input id="knowledgeSearch" placeholder="Søg..." oninput="renderKnowledgeList()">
        
        <select id="knowledgeCategoryFilter" onchange="renderKnowledgeList()">
          <option value="">Alle kategorier</option>
          ${KNOWLEDGE_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
        </select>
        
        <div id="knowledgeList" style="margin-top: 10px;"></div>
        
        <hr>
        <button onclick="exportKnowledgeJson()">Export JSON</button>
        <button onclick="importKnowledgeJson()">Import JSON</button>
      </div>
      
      <div class="main">
        <div id="knowledgeEditor" style="display: none;">
          <input id="knowledgeTitle" placeholder="Titel">
          
          <select id="knowledgeCategory">
            <option value="">Vælg kategori</option>
            ${KNOWLEDGE_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
          </select>
          
          <input id="knowledgeTags" placeholder="Tags (komma-separeret)">
          
          <textarea id="knowledgeContent" placeholder="Indhold..."></textarea>
          
          <div class="row">
            <button onclick="saveKnowledgeItem()">Gem</button>
            <button onclick="copyKnowledgeContent()" class="secondary">Kopiér</button>
            <button onclick="deleteKnowledgeItem()" class="danger">Slet</button>
          </div>
        </div>
        
        <div id="knowledgeEmpty" style="padding: 20px; text-align: center; color: #999;">
          Vælg eller opret en note
        </div>
      </div>
    </div>
  `);
  
  loadKnowledgeItems();
}

function loadKnowledgeItems() {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
    knowledgeItems = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("[loadKnowledgeItems]", error);
    knowledgeItems = [];
  }
  
  renderKnowledgeList();
}

function saveKnowledgeItems() {
  localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(knowledgeItems, null, 2));
}

function renderKnowledgeList() {
  const list = document.getElementById("knowledgeList");
  if (!list) return;
  
  const search = (getValue("knowledgeSearch") || "").toLowerCase();
  const categoryFilter = getValue("knowledgeCategoryFilter");
  
  const filtered = knowledgeItems.filter(item => {
    const matchesSearch = !search || 
      item.title.toLowerCase().includes(search) ||
      item.content.toLowerCase().includes(search) ||
      (item.tags || []).some(tag => tag.toLowerCase().includes(search));
    
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  list.innerHTML = filtered.map(item => `
    <button onclick="selectKnowledgeItem('${item.id}')" style="text-align: left; font-size: 13px;">
      <strong>${escapeHtml(item.title || "Uden titel")}</strong><br>
      <span class="muted">${escapeHtml(item.category || "")}</span>
    </button>
  `).join("");
}

function createKnowledgeItem() {
  currentKnowledgeItem = {
    id: Date.now().toString(),
    title: "",
    category: "",
    content: "",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  showKnowledgeEditor();
}

function selectKnowledgeItem(id) {
  currentKnowledgeItem = knowledgeItems.find(item => item.id === id);
  if (!currentKnowledgeItem) return;
  
  showKnowledgeEditor();
}

function showKnowledgeEditor() {
  const editor = document.getElementById("knowledgeEditor");
  const empty = document.getElementById("knowledgeEmpty");
  
  if (editor) editor.style.display = "block";
  if (empty) empty.style.display = "none";
  
  const titleEl = document.getElementById("knowledgeTitle");
  const categoryEl = document.getElementById("knowledgeCategory");
  const tagsEl = document.getElementById("knowledgeTags");
  const contentEl = document.getElementById("knowledgeContent");
  
  if (titleEl) titleEl.value = currentKnowledgeItem.title || "";
  if (categoryEl) categoryEl.value = currentKnowledgeItem.category || "";
  if (tagsEl) tagsEl.value = (currentKnowledgeItem.tags || []).join(", ");
  if (contentEl) contentEl.value = currentKnowledgeItem.content || "";
}

function saveKnowledgeItem() {
  if (!currentKnowledgeItem) return;
  
  currentKnowledgeItem.title = getValue("knowledgeTitle");
  currentKnowledgeItem.category = getValue("knowledgeCategory");
  currentKnowledgeItem.tags = getValue("knowledgeTags").split(",").map(t => t.trim()).filter(Boolean);
  currentKnowledgeItem.content = getValue("knowledgeContent");
  currentKnowledgeItem.updatedAt = new Date().toISOString();
  
  const existingIndex = knowledgeItems.findIndex(item => item.id === currentKnowledgeItem.id);
  
  if (existingIndex >= 0) {
    knowledgeItems[existingIndex] = currentKnowledgeItem;
  } else {
    knowledgeItems.push(currentKnowledgeItem);
  }
  
  saveKnowledgeItems();
  renderKnowledgeList();
  alert("Knowledge item gemt");
}

function deleteKnowledgeItem() {
  if (!currentKnowledgeItem) return;
  if (!confirm("Slet denne note?")) return;
  
  knowledgeItems = knowledgeItems.filter(item => item.id !== currentKnowledgeItem.id);
  saveKnowledgeItems();
  renderKnowledgeList();
  
  currentKnowledgeItem = null;
  const editor = document.getElementById("knowledgeEditor");
  const empty = document.getElementById("knowledgeEmpty");
  if (editor) editor.style.display = "none";
  if (empty) empty.style.display = "block";
}

function copyKnowledgeContent() {
  const content = getValue("knowledgeContent");
  navigator.clipboard.writeText(content);
  alert("Indhold kopieret");
}

function exportKnowledgeJson() {
  const json = JSON.stringify(knowledgeItems, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "knowledge-export-" + Date.now() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importKnowledgeJson() {
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
        
        knowledgeItems = [...knowledgeItems, ...imported];
        saveKnowledgeItems();
        renderKnowledgeList();
        alert("Importeret " + imported.length + " items");
      } catch (error) {
        alert("Import fejlede: " + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}
