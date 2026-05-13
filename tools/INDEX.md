# TOOLS PLATFORM - FILE INDEX

**Version:** 1.0.0  
**Updated:** 2026-05-11  
**Total Files:** 46 (36 new + 10 existing)

---

## 📁 FOUNDATION FILES (NEW)

### REGISTRIES (6 files)
```
tools/registries/
├── helper-registry.json          ← Track all helper functions
├── engine-registry.json          ← Track core engines
├── workflow-registry.json        ← Track workflows
├── prompt-registry.json          ← Track AI prompts
├── component-registry.json       ← Track UI components
└── dependency-map.json           ← Track relationships
```

### SCHEMAS (5 files)
```
tools/schemas/
├── helper.schema.json            ← Helper validation schema
├── engine.schema.json            ← Engine validation schema
├── workflow.schema.json          ← Workflow validation schema
├── prompt.schema.json            ← Prompt validation schema
└── relationship.schema.json      ← Relationship validation schema
```

### AGENTS (3 files)
```
tools/agents/
├── AGENT_START_RULES.md          ← **READ FIRST** - Universal rules
├── windsurf.rules.md             ← Windsurf Cascade specific
└── codex.rules.md                ← Codex specific
```

### WORKFLOWS (4 files)
```
tools/workflows/
├── feature.workflow.json         ← Feature development process
├── bugfix.workflow.json          ← Bug fixing process
├── deploy.workflow.json          ← Deployment process
└── refactor.workflow.json        ← Refactoring process
```

### LOGS (3 files)
```
tools/logs/
├── fixes.log.json                ← Bug fix history
├── decisions.log.json            ← Decision history
└── deployments.log.json          ← Deployment history
```

### DESKTOP MODULES (3 files)
```
tools/desktop-app/public/modules/
├── knowledge.module.js           ← Knowledge Base (7,213 bytes)
├── prompts.module.js             ← Prompt Library (7,213 bytes)
└── operations.module.js          ← Operations (7,214 bytes)
```

### DOCUMENTATION (6 files)
```
tools/
├── README.md                     ← Platform documentation
├── FOUNDATION_COMPLETE.md        ← Completion status
├── MIGRATION.md                  ← Migration guide
├── QUICKSTART.md                 ← Quick reference
├── PHASE1_SUMMARY.md             ← Phase 1 summary
└── INDEX.md                      ← This file
```

### CONFIG (1 file)
```
tools/
└── .gitignore                    ← Git ignore rules
```

### PLACEHOLDERS (6 files)
```
tools/memory/knowledge/.gitkeep
tools/memory/prompts/.gitkeep
tools/memory/operations/.gitkeep
tools/memory/ideas/.gitkeep
tools/memory/decisions/.gitkeep
tools/scanners/.gitkeep
```

---

## 📁 EXISTING FILES (PRESERVED)

### DESKTOP APP (4 files)
```
tools/desktop-app/
├── README.md                     ← Desktop app docs
├── TEST-CHECKLIST.md             ← Test checklist
├── server.cjs                    ← Express server
└── public/
    ├── index.html                ← Main UI (MODIFIED)
    ├── desktop.js                ← Core functions
    ├── desktop-modules.js        ← DEPRECATED (replaced by modules/)
    └── style.css                 ← Styles
```

### CODE CHUNKS (23 files)
```
tools/code-chunks/
├── functions_index_js.rebuilt.js
├── functions_index_js/
│   ├── chunk-001.ai.txt
│   ├── chunk-001.txt
│   ├── ... (34 files total)
└── index/
    ├── chunk-001.js
    ├── ... (11 files total)
    └── manifest.json
```

### CODE SPLITTERS (2 files)
```
tools/
├── code-splitter-web.cjs
└── code-splitter.cjs
```

---

## 📊 FILE STATISTICS

### By Type
- **JSON:** 18 files (registries, schemas, workflows, logs)
- **Markdown:** 11 files (docs, rules, workflows)
- **JavaScript:** 17 files (modules, chunks, splitters)
- **Config:** 1 file (.gitignore)
- **Placeholder:** 6 files (.gitkeep)
- **Other:** 3 files (server.cjs, index.html, style.css)

### By Category
- **Foundation:** 36 files (NEW)
- **Desktop App:** 7 files (1 modified, 6 existing)
- **Code Chunks:** 23 files (existing)
- **Utilities:** 2 files (existing)

### By Status
- **New:** 36 files
- **Modified:** 1 file (index.html)
- **Deprecated:** 1 file (desktop-modules.js)
- **Preserved:** 9 files

---

## 🎯 QUICK NAVIGATION

### Start Here
1. `agents/AGENT_START_RULES.md` ← **READ FIRST**
2. `QUICKSTART.md` ← Quick reference
3. `README.md` ← Full documentation

### Before Coding
1. `registries/helper-registry.json` ← Check for helpers
2. `registries/engine-registry.json` ← Check for engines
3. `registries/dependency-map.json` ← Check dependencies

### During Development
1. `workflows/feature.workflow.json` ← Feature process
2. `workflows/bugfix.workflow.json` ← Bug process
3. `workflows/deploy.workflow.json` ← Deploy process

### After Development
1. `logs/decisions.log.json` ← Log decisions
2. `logs/fixes.log.json` ← Log fixes
3. `logs/deployments.log.json` ← Log deployments

---

## 🔍 SEARCH GUIDE

### Find Helper
```bash
grep -r "helperName" tools/registries/helper-registry.json
```

### Find Engine
```bash
grep -r "engineName" tools/registries/engine-registry.json
```

### Find Workflow
```bash
ls tools/workflows/
cat tools/workflows/feature.workflow.json
```

### Find Documentation
```bash
ls tools/*.md
cat tools/README.md
```

---

## 📝 FILE PURPOSES

### REGISTRIES
**Purpose:** Track all code entities to prevent duplication

**When to use:**
- Before creating new helper
- Before creating new engine
- Before creating new component
- When understanding dependencies

### SCHEMAS
**Purpose:** Define structure and validation rules

**When to use:**
- When adding to registries
- When validating data
- When understanding structure

### AGENTS
**Purpose:** Rules for AI agents

**When to use:**
- Before ANY development
- When using Windsurf
- When using Codex
- When making decisions

### WORKFLOWS
**Purpose:** Standard processes

**When to use:**
- When adding feature
- When fixing bug
- When deploying
- When refactoring

### LOGS
**Purpose:** Track history

**When to use:**
- After fixing bug
- After making decision
- After deploying

### MODULES
**Purpose:** Desktop app functionality

**When to use:**
- Managing knowledge
- Managing prompts
- Managing operations

---

## 🎓 LEARNING ORDER

1. **Day 1:** Read `AGENT_START_RULES.md`
2. **Day 1:** Read `QUICKSTART.md`
3. **Day 1:** Explore registries
4. **Day 2:** Read all workflows
5. **Day 2:** Understand schemas
6. **Day 3:** Practice using desktop app
7. **Day 3:** Log first decision

---

## ✅ VERIFICATION

All files verified:
- ✅ JSON syntax valid (18 files)
- ✅ JavaScript syntax valid (17 files)
- ✅ Markdown formatted (11 files)
- ✅ Folders created (8 folders)
- ✅ Placeholders in place (6 files)

---

## 🚀 NEXT STEPS

**Phase 2: Population**
- Scan codebase
- Populate registries
- Map dependencies
- Document critical areas

**See:** `PHASE1_SUMMARY.md` for details

---

**Total:** 46 files indexed  
**Status:** Foundation complete  
**Ready:** Phase 2 population
