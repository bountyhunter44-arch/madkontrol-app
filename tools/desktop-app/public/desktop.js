// ================= GLOBAL STATE =================

let currentFile = null;
let selectedChunk = null;
let smartMergeTargetFile = null;
let topZ = 10;
let windowOffset = 0;

// ================= WINDOW SYSTEM =================

function createWindow(title, content) {
  windowOffset += 24;
  if (windowOffset > 140) windowOffset = 24;

  const win = document.createElement("div");
  win.className = "window";
  win.style.left = 90 + windowOffset + "px";
  win.style.top = 80 + windowOffset + "px";
  win.style.zIndex = ++topZ;

  win.innerHTML = `
    <div class="titlebar">
      <div class="window-title">${title}</div>
      <button class="window-close" type="button">×</button>
    </div>
    <div class="window-inner">${content}</div>
  `;

  document.body.appendChild(win);

  win.addEventListener("mousedown", () => {
    win.style.zIndex = ++topZ;
  });

  win.querySelector(".window-close").onclick = () => win.remove();

  makeWindowDraggable(win);

  return win;
}

function makeWindowDraggable(win) {
  const titlebar = win.querySelector(".titlebar");

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  titlebar.addEventListener("mousedown", event => {
    if (event.target.classList.contains("window-close")) return;

    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = win.offsetLeft;
    startTop = win.offsetTop;
    win.style.zIndex = ++topZ;

    event.preventDefault();
  });

  document.addEventListener("mousemove", event => {
    if (!dragging) return;

    win.style.left = Math.max(0, startLeft + event.clientX - startX) + "px";
    win.style.top = Math.max(0, startTop + event.clientY - startY) + "px";
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

// ================= HELPERS =================

async function fetchJson(resource, options = {}) {
  const res = await fetch(resource, options);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function showError(id, error) {
  setText(id, "FEJL:\n" + (error.message || String(error)));
}

// ================= EXPLORER =================

function openExplorer() {
  createWindow("Explorer", `
    <div class="window-content">
      <div class="sidebar">
        <button onclick="loadFiles()">Load files</button>
        <div id="fileList"></div>
      </div>
      <div class="main">
        <button onclick="saveFile()">Save</button>
        <textarea id="editor"></textarea>
      </div>
    </div>
  `);
}

async function loadFiles() {
  const data = await fetchJson("/api/files");
  const list = document.getElementById("fileList");
  list.innerHTML = "";

  data.files.forEach(file => {
    const btn = document.createElement("button");
    btn.textContent = file;
    btn.onclick = async () => {
      currentFile = file;
      const res = await fetchJson("/api/read?path=" + encodeURIComponent(file));
      document.getElementById("editor").value = res.content;
    };
    list.appendChild(btn);
  });
}

async function saveFile() {
  await fetchJson("/api/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: currentFile,
      content: document.getElementById("editor").value
    })
  });
  alert("Saved");
}

// ================= SPLITTER =================

function openSplitter() {
  createWindow("Splitter", `
    <div class="window-content">
      <div class="sidebar">
        <input id="filePath" value="functions/index.js">
        <button onclick="runSplit()">Split</button>
      </div>
      <div class="main">
        <pre id="output"></pre>
      </div>
    </div>
  `);
}

async function runSplit() {
  const data = await fetchJson("/api/split", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: getValue("filePath"),
      linesPerChunk: 500
    })
  });
  setText("output", JSON.stringify(data, null, 2));
}

// ================= PROMPT =================

function openPrompt() {
  createWindow("Prompt", `
    <div class="window-content">
      <div class="sidebar">
        <button onclick="loadChunkDirs()">Load chunks</button>
        <div id="chunkDirs"></div>
      </div>
      <div class="main">
        <pre id="promptOutput"></pre>
      </div>
    </div>
  `);
}

// ================= AI HELPER =================

function openAIPanel() {
  createWindow("AI Helper", `
    <div class="window-content">
      <textarea id="aiInput"></textarea>
    </div>
  `);
}

// ================= SMART MERGE =================

function openSmartMerge() {
  createWindow("Smart Merge", `
    <div class="window-content">
      <div class="main">
        <textarea id="smartMergeReplacement"></textarea>
      </div>
    </div>
  `);
}

// ================= FIRMA IMPORT =================

let importedCompanies = [];
let filteredCompanies = [];
let companyBatchIndex = 0;
const companyBatchSize = 10;
let companyBatchOutputMode = "batch";
let companyBatchOutputText = "";
let crmLeads = [];

const crmStorageKey = "madkontrollen_crm_leads";
const crmStatuses = [
  "new",
  "not_contacted",
  "contacted",
  "interested",
  "demo_sent",
  "follow_up",
  "not_relevant",
  "customer"
];
const crmInterestLevels = ["unknown", "low", "medium", "high"];

function openCompanyImporter() {
  createWindow("Firma Import", `
    <div class="window-content">
      <div class="sidebar">
        <input id="companyFileInput" type="file" accept=".csv,.json,.txt">
        <button onclick="loadCompanyFile()">Importér fil</button>

        <hr>

        <input id="companySearchInput" placeholder="Søg firma, CVR, adresse...">
        <button onclick="searchCompanies()">Søg</button>
        <button onclick="resetCompanySearch()">Nulstil søgning</button>

        <hr>

        <button onclick="previousCompanyBatch()">Forrige 10</button>
        <button onclick="nextCompanyBatch()">Næste 10</button>

        <hr>

        <button onclick="generateSeedFromCompanies()">Lav Seed</button>
        <button onclick="addCurrentBatchToCrm()">Send batch til CRM</button>
        <button onclick="addAllImportedToCrm()">Send alle til CRM</button>
        <button onclick="openCrm()">Åbn CRM</button>
        <button onclick="copyCompanyBatchJson()">Kopiér viste 10 som JSON</button>
        <button onclick="copyCompanyBatchCsv()">Kopiér viste 10 som CSV</button>

        <div class="muted" id="companyImportStatus">
          Ingen fil importeret.
        </div>
      </div>

      <div class="main">
        <pre id="companyBatchOutput">Importér CSV eller JSON for at starte.</pre>
      </div>
    </div>
  `);
}

function loadCompanyFile() {
  const input = document.getElementById("companyFileInput");

  if (!input || !input.files || input.files.length === 0) {
    alert("Vælg en CSV- eller JSON-fil først.");
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  reader.onload = event => {
    try {
      const content = String(event.target.result || "").replace(/^\uFEFF/, "");

      if (content.startsWith("PK")) {
        throw new Error("Filen ligner Excel/XLSX. Gem den som CSV UTF-8 og importer den igen.");
      }

      if (fileName.endsWith(".json")) {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON-filen skal være et array af firmaer.");
        }
        importedCompanies = parsed.map((row, index) => normalizeCompanyRow(normalizeRawCompanyObject(row), index));
      } else {
        importedCompanies = parseCompanyCsv(content);
      }

      filteredCompanies = [...importedCompanies];
      companyBatchIndex = 0;
      renderCompanyBatch();
    } catch (error) {
      companyBatchOutputMode = "error";
      companyBatchOutputText = "FEJL:\n" + (error.message || String(error));
      setText("companyBatchOutput", companyBatchOutputText);
    }
  };

  reader.readAsText(file, "UTF-8");
}

function parseCompanyCsv(content) {
  const lines = splitCsvLines(String(content || "").replace(/^\uFEFF/, ""))
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV-filen skal have header og mindst én række.");
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = splitCompanyCsvLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line, index) => {
    const values = splitCompanyCsvLine(line, delimiter);
    const raw = {};

    headers.forEach((header, headerIndex) => {
      raw[header] = values[headerIndex] || "";
    });

    return normalizeCompanyRow(raw, index);
  });
}

function detectCsvDelimiter(headerLine) {
  const candidates = [",", ";", "\t"];
  let bestDelimiter = ",";
  let bestCount = -1;

  candidates.forEach(delimiter => {
    const count = countDelimiterOutsideQuotes(headerLine, delimiter);
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  });

  return bestDelimiter;
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

function splitCsvLines(content) {
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += char + next;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      lines.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  lines.push(current);
  return lines;
}

function splitCompanyCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(header) {
  return normalizeDanishText(header)
    .replace(/\s+/g, "");
}

function normalizeDanishText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa");
}

function normalizeRawCompanyObject(raw) {
  const normalized = {};

  Object.entries(raw || {}).forEach(([key, value]) => {
    normalized[normalizeHeader(key)] = value;
  });

  return normalized;
}

function firstCompanyField(raw, keys) {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeCompanyRow(raw, rowIndex = 0) {
  const company = {
    name: firstCompanyField(raw, ["firmanavn", "navn", "name", "companyname", "virksomhed"]),
    cvr: firstCompanyField(raw, ["cvr", "cvrnummer", "cvrnr", "vat"]).replace(/\s+/g, ""),
    address: firstCompanyField(raw, ["adresse", "address", "vej", "street"]),
    postalCode: firstCompanyField(raw, ["postnummer", "postalcode", "zip"]),
    city: firstCompanyField(raw, ["by", "city"]),
    website: firstCompanyField(raw, ["hjemmeside", "website", "url", "web"]),
    phone: firstCompanyField(raw, ["telefon", "phone", "tlf", "mobile"]),
    email: firstCompanyField(raw, ["email", "mail", "kontaktemail"])
  };

  Object.defineProperty(company, "__importIndex", {
    value: rowIndex,
    enumerable: false,
    configurable: true
  });

  return company;
}

function slugifyLocationPart(value) {
  return normalizeDanishText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/^-+|-+$/g, "");
}

function getCompanyId(company, index) {
  const cvr = String(company?.cvr || "").replace(/\s+/g, "");
  return cvr || "missing-cvr-" + index;
}

function getLocationId(company, companyId) {
  const slug = slugifyLocationPart([
    company.address,
    company.postalCode,
    company.city
  ].filter(Boolean).join(" "));

  return companyId + "_" + (slug || "location");
}

function buildCompanySeed(company, index) {
  const companyId = getCompanyId(company, index);
  const locationId = getLocationId(company, companyId);
  const prettyLocationName = [
    company.address,
    [company.postalCode, company.city].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");

  return {
    company: {
      id: companyId,
      companyId,
      cvr: company.cvr || "",
      name: company.name || "",
      prettyName: company.name || "",
      status: "active",
      source: "csv-import"
    },
    location: {
      id: locationId,
      companyId,
      locationId,
      name: company.address || "",
      prettyName: prettyLocationName,
      address: company.address || "",
      postalCode: company.postalCode || "",
      city: company.city || "",
      website: company.website || "",
      status: "active",
      source: "csv-import"
    },
    user: {
      uid: "user_" + companyId,
      email: company.email || "",
      // Demo seed only. Production users must be created through Firebase Auth/onboarding.
      password: "Test1234!",
      companyId,
      locationId,
      role: "owner",
      status: "active",
      source: "csv-import"
    }
  };
}

function searchCompanies() {
  const query = getValue("companySearchInput").toLowerCase().trim();

  filteredCompanies = importedCompanies.filter(company =>
    Object.values(company).join(" ").toLowerCase().includes(query)
  );

  companyBatchIndex = 0;
  renderCompanyBatch();
}

function resetCompanySearch() {
  const input = document.getElementById("companySearchInput");
  if (input) input.value = "";

  filteredCompanies = [...importedCompanies];
  companyBatchIndex = 0;
  renderCompanyBatch();
}

function getCurrentCompanyBatch() {
  const start = companyBatchIndex * companyBatchSize;
  return filteredCompanies.slice(start, start + companyBatchSize);
}

function renderCompanyBatch() {
  const batch = getCurrentCompanyBatch();
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / companyBatchSize));
  const text = JSON.stringify(batch, null, 2);

  setText(
    "companyImportStatus",
    "Total: " + importedCompanies.length +
    "\nEfter søgning: " + filteredCompanies.length +
    "\nSide: " + (companyBatchIndex + 1) + "/" + totalPages
  );

  companyBatchOutputMode = "batch";
  companyBatchOutputText = text;
  setText("companyBatchOutput", text);
}

function previousCompanyBatch() {
  if (companyBatchIndex > 0) {
    companyBatchIndex--;
    renderCompanyBatch();
  }
}

function nextCompanyBatch() {
  if ((companyBatchIndex + 1) * companyBatchSize < filteredCompanies.length) {
    companyBatchIndex++;
    renderCompanyBatch();
  }
}

function generateSeedFromCompanies() {
  const batch = getCurrentCompanyBatch();

  if (batch.length === 0) {
    alert("Ingen firmaer i den aktuelle batch.");
    return [];
  }

  const seed = batch.map((company, index) =>
    buildCompanySeed(company, company.__importIndex ?? (companyBatchIndex * companyBatchSize + index))
  );
  const text = JSON.stringify(seed, null, 2);

  companyBatchOutputMode = "seed";
  companyBatchOutputText = text;
  setText("companyBatchOutput", text);

  return seed;
}

function copyCompanyBatchJson() {
  const text = companyBatchOutputMode === "seed"
    ? companyBatchOutputText
    : JSON.stringify(getCurrentCompanyBatch(), null, 2);

  navigator.clipboard.writeText(text);
  setText("companyBatchOutput", text);
  alert("Kopieret JSON");
}

function copyCompanyBatchCsv() {
  const batch = getCurrentCompanyBatch();
  const headers = ["name", "cvr", "address", "postalCode", "city", "website", "phone", "email"];

  const rows = batch.map(company =>
    headers.map(header => csvEscape(company[header] || "")).join(";")
  );

  const csv = headers.join(";") + "\n" + rows.join("\n");

  navigator.clipboard.writeText(csv);
  setText("companyBatchOutput", csv);
  companyBatchOutputMode = "csv";
  companyBatchOutputText = csv;
  alert("Kopieret CSV");
}

function csvEscape(value) {
  const text = String(value || "");

  if (text.includes(";") || text.includes(",") || text.includes("\t") || text.includes('"') || text.includes("\n")) {
    return '"' + text.replaceAll('"', '""') + '"';
  }

  return text;
}

// ================= CRM / LEADS =================

function openCrm() {
  createWindow("CRM / Leads", `
    <div class="window-content">
      <div class="sidebar">
        <input id="crmSearchInput" placeholder="Søg lead, CVR, by..." oninput="renderCrmLeads()">
        <button onclick="loadCrmLeads()">Load CRM</button>
        <button onclick="exportCrmJson()">Export JSON</button>
        <button onclick="copyCrmJson()">Copy JSON</button>

        <hr>

        <div class="muted" id="crmStatus">
          CRM ikke indlæst.
        </div>
      </div>

      <div class="main">
        <div id="crmLeadsList"></div>
        <pre id="crmJsonOutput"></pre>
      </div>
    </div>
  `);

  loadCrmLeads();
}

function addCurrentBatchToCrm() {
  const batch = getCurrentCompanyBatch();

  if (batch.length === 0) {
    alert("Ingen firmaer i den aktuelle batch.");
    return [];
  }

  return addCompaniesToCrm(batch, companyBatchIndex * companyBatchSize);
}

function addAllImportedToCrm() {
  if (importedCompanies.length === 0) {
    alert("Ingen importerede firmaer at sende til CRM.");
    return [];
  }

  return addCompaniesToCrm(importedCompanies, 0);
}

function addCompaniesToCrm(companies, offset = 0) {
  loadCrmLeads(false);

  let created = 0;
  let updated = 0;

  companies.forEach((company, index) => {
    const importIndex = company.__importIndex ?? (offset + index);
    const lead = normalizeCompanyToLead(company, importIndex);
    const existingIndex = crmLeads.findIndex(existingLead => existingLead.leadId === lead.leadId);

    if (existingIndex >= 0) {
      const existingLead = crmLeads[existingIndex];
      crmLeads[existingIndex] = {
        ...existingLead,
        ...lead,
        status: existingLead.status || lead.status,
        contactStatus: existingLead.contactStatus || lead.contactStatus,
        interestLevel: existingLead.interestLevel || lead.interestLevel,
        lastContactedAt: existingLead.lastContactedAt || "",
        nextFollowUpAt: existingLead.nextFollowUpAt || "",
        notes: existingLead.notes || "",
        createdAt: existingLead.createdAt || lead.createdAt,
        updatedAt: new Date().toISOString()
      };
      updated++;
      return;
    }

    crmLeads.push(lead);
    created++;
  });

  saveCrmLeads();
  renderCrmLeads();
  setText("crmStatus", "CRM opdateret: " + created + " nye, " + updated + " opdateret.");
  alert("CRM opdateret: " + created + " nye, " + updated + " opdateret.");

  return crmLeads;
}

function normalizeCompanyToLead(company, index) {
  const leadId = getCompanyId(company, index);
  const now = new Date().toISOString();

  return {
    leadId,
    companyId: leadId,
    cvr: company?.cvr || "",
    name: company?.name || "",
    address: company?.address || "",
    postalCode: company?.postalCode || "",
    city: company?.city || "",
    website: company?.website || "",
    phone: company?.phone || "",
    email: company?.email || "",
    status: "new",
    contactStatus: "not_contacted",
    interestLevel: "unknown",
    lastContactedAt: "",
    nextFollowUpAt: "",
    notes: "",
    source: "csv-import",
    createdAt: now,
    updatedAt: now
  };
}

function saveCrmLeads() {
  localStorage.setItem(crmStorageKey, JSON.stringify(crmLeads, null, 2));
}

function loadCrmLeads(shouldRender = true) {
  try {
    const raw = localStorage.getItem(crmStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];

    crmLeads = Array.isArray(parsed)
      ? parsed.map((lead, index) => normalizeStoredCrmLead(lead, index))
      : [];
  } catch (error) {
    console.error("[loadCrmLeads]", error);
    crmLeads = [];
    alert("CRM-data kunne ikke indlæses fra localStorage.");
  }

  if (shouldRender) {
    renderCrmLeads();
  }

  return crmLeads;
}

function normalizeStoredCrmLead(lead, index) {
  const leadId = String(lead?.leadId || lead?.companyId || lead?.cvr || "missing-cvr-" + index).replace(/\s+/g, "");
  const now = new Date().toISOString();

  return {
    leadId,
    companyId: lead?.companyId || leadId,
    cvr: lead?.cvr || "",
    name: lead?.name || "",
    address: lead?.address || "",
    postalCode: lead?.postalCode || "",
    city: lead?.city || "",
    website: lead?.website || "",
    phone: lead?.phone || "",
    email: lead?.email || "",
    status: crmStatuses.includes(lead?.status) ? lead.status : "new",
    contactStatus: lead?.contactStatus || "not_contacted",
    interestLevel: crmInterestLevels.includes(lead?.interestLevel) ? lead.interestLevel : "unknown",
    lastContactedAt: lead?.lastContactedAt || "",
    nextFollowUpAt: lead?.nextFollowUpAt || "",
    notes: lead?.notes || "",
    source: lead?.source || "csv-import",
    createdAt: lead?.createdAt || now,
    updatedAt: lead?.updatedAt || now
  };
}

function renderCrmLeads() {
  const list = document.getElementById("crmLeadsList");
  if (!list) return;

  const query = getValue("crmSearchInput").toLowerCase().trim();
  const visibleLeads = crmLeads.filter(lead =>
    [
      lead.leadId,
      lead.cvr,
      lead.name,
      lead.address,
      lead.postalCode,
      lead.city,
      lead.website,
      lead.phone,
      lead.email,
      lead.status,
      lead.interestLevel,
      lead.notes
    ].join(" ").toLowerCase().includes(query)
  );

  setText("crmStatus", "Leads: " + crmLeads.length + "\nViser: " + visibleLeads.length);

  if (visibleLeads.length === 0) {
    list.innerHTML = "<p>Ingen leads at vise.</p>";
    return;
  }

  list.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Firma</th>
          <th>Kontakt</th>
          <th>Status</th>
          <th>Interesse</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        ${visibleLeads.map(lead => renderCrmLeadRow(lead)).join("")}
      </tbody>
    </table>
  `;
}

function renderCrmLeadRow(lead) {
  const leadId = escapeHtml(lead.leadId);
  const addressLine = [
    lead.address,
    [lead.postalCode, lead.city].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");
  const contactLine = [
    lead.phone,
    lead.email,
    lead.website
  ].filter(Boolean).join("\n");

  return `
    <tr>
      <td>
        <strong>${escapeHtml(lead.name || "(uden navn)")}</strong><br>
        <span class="muted">CVR: ${escapeHtml(lead.cvr || lead.leadId)}</span><br>
        <span class="muted">${escapeHtml(addressLine)}</span>
      </td>
      <td><pre>${escapeHtml(contactLine)}</pre></td>
      <td>
        <select data-lead-id="${leadId}" onchange="updateCrmLead(this.dataset.leadId, 'status', this.value)">
          ${renderOptions(crmStatuses, lead.status)}
        </select>
      </td>
      <td>
        <select data-lead-id="${leadId}" onchange="updateCrmLead(this.dataset.leadId, 'interestLevel', this.value)">
          ${renderOptions(crmInterestLevels, lead.interestLevel)}
        </select>
      </td>
      <td>
        <textarea data-lead-id="${leadId}" oninput="updateCrmLead(this.dataset.leadId, 'notes', this.value)">${escapeHtml(lead.notes)}</textarea>
      </td>
    </tr>
  `;
}

function renderOptions(options, selectedValue) {
  return options.map(option => {
    const selected = option === selectedValue ? " selected" : "";
    return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
  }).join("");
}

function updateCrmLead(leadId, field, value) {
  const editableFields = [
    "status",
    "contactStatus",
    "interestLevel",
    "lastContactedAt",
    "nextFollowUpAt",
    "notes"
  ];

  if (!editableFields.includes(field)) return;

  const lead = crmLeads.find(item => item.leadId === leadId);
  if (!lead) return;

  if (field === "status" && !crmStatuses.includes(value)) return;
  if (field === "interestLevel" && !crmInterestLevels.includes(value)) return;

  lead[field] = value;
  lead.updatedAt = new Date().toISOString();
  saveCrmLeads();
  setText("crmStatus", "Lead gemt: " + (lead.name || lead.leadId));
}

function exportCrmJson() {
  const text = JSON.stringify(crmLeads, null, 2);
  setText("crmJsonOutput", text);
  return text;
}

function copyCrmJson() {
  const text = exportCrmJson();
  navigator.clipboard.writeText(text);
  alert("CRM JSON kopieret");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Firma Import global exports
window.openCompanyImporter = openCompanyImporter;
window.loadCompanyFile = loadCompanyFile;
window.searchCompanies = searchCompanies;
window.resetCompanySearch = resetCompanySearch;
window.previousCompanyBatch = previousCompanyBatch;
window.nextCompanyBatch = nextCompanyBatch;
window.copyCompanyBatchJson = copyCompanyBatchJson;
window.copyCompanyBatchCsv = copyCompanyBatchCsv;
window.generateSeedFromCompanies = generateSeedFromCompanies;
window.openCrm = openCrm;
window.addCurrentBatchToCrm = addCurrentBatchToCrm;
window.addAllImportedToCrm = addAllImportedToCrm;
window.loadCrmLeads = loadCrmLeads;
window.renderCrmLeads = renderCrmLeads;
window.updateCrmLead = updateCrmLead;
window.exportCrmJson = exportCrmJson;
window.copyCrmJson = copyCrmJson;
