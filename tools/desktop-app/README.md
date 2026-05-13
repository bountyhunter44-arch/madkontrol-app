# Desktop App - AI Operations Center

Lokal arbejdsstation til AI-assisteret udvikling af Madkontrollen og LexiVoice.

## Moduler

### 📚 Knowledge Base
Projektviden og arkitektur-noter:
- **Kategorier:** madkontrollen, lexivoice, firebase, architecture, bugs, decisions, do-not-change
- **Features:** Søgning, tags, export/import JSON
- **Storage:** `localStorage: tools.knowledge.items`

### 💬 Prompt Library
Genbrugelige AI prompts:
- **Kategorier:** windsurf, codex, debug, deploy, firestore, ui, refactor, hotfix
- **Features:** Søgning, tags, copy-knap, export/import JSON
- **Storage:** `localStorage: tools.prompts.items`

### ⚙️ Operations
Checklists og procedurer:
- **Kategorier:** cvr-import, backup, deploy, release, support, logs, qa-checklist
- **Features:** Søgning, tags, export/import JSON
- **Storage:** `localStorage: tools.operations.items`

### 📁 Explorer
Fil-browser og editor (eksisterende)

### ✦ Splitter
Code splitter til store filer (eksisterende)

### SM Smart Merge
Intelligent merge tool (eksisterende)

### CVR Firma Import
CSV/JSON import med CRM (eksisterende)

## Datastruktur

Alle moduler bruger samme item-struktur:

```json
{
  "id": "timestamp-string",
  "title": "Kort titel",
  "category": "kategori-navn",
  "content": "Tekstindhold",
  "tags": ["tag1", "tag2"],
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

## Start Server

```bash
cd tools/desktop-app
node server.cjs
```

Åbn: http://localhost:3000

## Filer

- `public/index.html` - Desktop UI og styling
- `public/desktop.js` - Eksisterende funktioner (Explorer, Splitter, CRM)
- `public/desktop-modules.js` - Nye moduler (Knowledge, Prompts, Operations)
- `server.cjs` - Express server med API endpoints

## Features

### Alle Moduler
- ✅ Søgning i titel, indhold og tags
- ✅ Kategori-filter
- ✅ Export til JSON
- ✅ Import fra JSON
- ✅ Copy-knap for indhold
- ✅ localStorage persistence
- ✅ Draggable/resizable windows
- ✅ Offline-first

### Knowledge Base
Gem vigtig projektviden:
- Firebase collection paths
- Rutine-engine noter
- "Do-not-change" regler
- Bug history
- Arkitektur beslutninger

### Prompt Library
Gem genbrugelige prompts:
- Windsurf Cascade prompts
- Debug workflows
- Deploy checklists
- Firestore rules prompts
- Emergency hotfix templates

### Operations
Gem procedurer:
- CVR import guide
- Backup procedures
- Deploy checklists
- Release workflows
- Support templates
- QA checklists

## Workflow

1. **Brainstorm** → Gem i Knowledge Base
2. **Prompt** → Gem i Prompt Library
3. **Execute** → Brug Windsurf/Codex
4. **Deploy** → Følg Operations checklist
5. **Document** → Opdater Knowledge Base

## Backup

Export JSON fra alle moduler regelmæssigt:
- Knowledge: `knowledge-export-{timestamp}.json`
- Prompts: `prompts-export-{timestamp}.json`
- Operations: `operations-export-{timestamp}.json`

Gem backups i Git repo eller cloud storage.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS
- **Storage:** localStorage
- **Server:** Express.js (Node.js)
- **No frameworks:** Ingen build step
- **No database:** Alt lokalt først

## Future Enhancements

- [ ] Sync til Firebase (optional)
- [ ] Markdown rendering
- [ ] Code syntax highlighting
- [ ] Keyboard shortcuts
- [ ] Dark mode
- [ ] Full-text search
- [ ] Version history
- [ ] Collaboration features
