# TOOLS PLATFORM - QUICKSTART

**Version:** 1.0.0  
**Updated:** 2026-05-11

---

## 🚀 START HERE

### 1. Read Agent Rules (5 min)
```bash
cat tools/agents/AGENT_START_RULES.md
```

### 2. Start Desktop App (30 sec)
```bash
cd tools/desktop-app
node server.cjs
# Open http://localhost:3000
```

### 3. Check Registries (2 min)
```bash
cat tools/registries/helper-registry.json
cat tools/registries/engine-registry.json
cat tools/registries/dependency-map.json
```

---

## 📋 BEFORE CODING CHECKLIST

- [ ] Read `agents/AGENT_START_RULES.md`
- [ ] Check `registries/` for existing code
- [ ] Check `workflows/` for process
- [ ] Check `memory/` for context
- [ ] Understand dependencies

---

## 🎯 COMMON TASKS

### Add New Feature
```bash
# 1. Check workflow
cat tools/workflows/feature.workflow.json

# 2. Check for existing code
grep -r "functionName" tools/registries/

# 3. Follow workflow steps
# 4. Update registries
# 5. Log decision
```

### Fix Bug
```bash
# 1. Check workflow
cat tools/workflows/bugfix.workflow.json

# 2. Reproduce bug
# 3. Find root cause
# 4. Make minimal fix
# 5. Log fix
```

### Deploy
```bash
# 1. Check workflow
cat tools/workflows/deploy.workflow.json

# 2. Verify syntax
# 3. Test locally
# 4. Deploy
# 5. Log deployment
```

---

## 📁 FOLDER QUICK REFERENCE

```
tools/
├── registries/      → Check BEFORE coding
├── schemas/         → Validation rules
├── agents/          → AI agent rules (READ FIRST)
├── workflows/       → Standard processes
├── memory/          → Knowledge & prompts
├── logs/            → History & decisions
└── desktop-app/     → UI for tools
```

---

## 🔍 FIND EXISTING CODE

### Search Helpers
```bash
grep -r "helperName" tools/registries/helper-registry.json
```

### Search Engines
```bash
grep -r "engineName" tools/registries/engine-registry.json
```

### Search Components
```bash
grep -r "componentName" tools/registries/component-registry.json
```

---

## 📝 LOG DECISION

```bash
# Edit tools/logs/decisions.log.json
{
  "entries": [
    {
      "id": "1715432100000",
      "date": "2026-05-11T17:35:00Z",
      "type": "decision",
      "description": "Why we chose X over Y",
      "details": {
        "alternatives": ["X", "Y", "Z"],
        "chosen": "X",
        "rationale": "Because...",
        "risks": ["Risk 1", "Risk 2"]
      },
      "tags": ["architecture", "madkontrollen"]
    }
  ]
}
```

---

## ⚠️ CRITICAL RULES

1. **NO CODE BEFORE REGISTRY CHECK**
2. **NO NEW HELPER BEFORE AUDIT**
3. **NO DUPLICATE LOGIC**
4. **REUSE FIRST**
5. **MINIMAL CHANGES**
6. **FOLLOW WORKFLOWS**
7. **LOG DECISIONS**

---

## 🎓 LEARNING PATH

### Day 1
- [ ] Read `AGENT_START_RULES.md`
- [ ] Explore registries
- [ ] Start desktop app
- [ ] Read one workflow

### Day 2
- [ ] Read all workflows
- [ ] Understand schemas
- [ ] Practice registry checks
- [ ] Log a decision

### Day 3
- [ ] Follow feature workflow
- [ ] Update a registry
- [ ] Use desktop app
- [ ] Review logs

---

## 🆘 HELP

### Desktop App Not Working?
```bash
cd tools/desktop-app
node server.cjs
# Check http://localhost:3000
# Check browser console (F12)
```

### Can't Find Existing Code?
```bash
# Search all registries
grep -r "searchTerm" tools/registries/
```

### Don't Know Which Workflow?
```bash
# Feature: feature.workflow.json
# Bug: bugfix.workflow.json
# Deploy: deploy.workflow.json
# Refactor: refactor.workflow.json
```

### Need Context?
```bash
# Check memory
ls tools/memory/knowledge/
ls tools/memory/prompts/
```

---

## 📚 DOCUMENTATION

- `README.md` - Full platform docs
- `FOUNDATION_COMPLETE.md` - Completion status
- `MIGRATION.md` - Migration guide
- `QUICKSTART.md` - This file

---

## 🎯 REMEMBER

**Goal:** Solve problems with minimal, safe changes  
**Method:** Reuse → Extend → Refactor → Create  
**Tools:** Registries, workflows, agents, logs

**Start with registries. End with logs. Follow workflows.**
