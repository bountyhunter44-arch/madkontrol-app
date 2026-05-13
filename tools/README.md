# TOOLS PLATFORM FOUNDATION

**Version:** 1.0.0  
**Created:** 2026-05-11

## STRUCTURE

```
tools/
├── registries/          # Code registries (helpers, engines, components)
├── schemas/             # JSON schemas for validation
├── agents/              # AI agent rules and guidelines
├── workflows/           # Development workflow definitions
├── memory/              # Persistent knowledge and prompts
│   ├── knowledge/       # Project knowledge
│   ├── prompts/         # AI prompts
│   ├── operations/      # Operations procedures
│   ├── ideas/           # Feature ideas
│   └── decisions/       # Decision logs
├── logs/                # Activity logs
├── scanners/            # Code scanners (future)
└── desktop-app/         # Desktop UI
    └── public/
        └── modules/     # Modular desktop components
```

## REGISTRIES

### Purpose
Track all code entities to prevent duplication and understand dependencies.

### Files
- `helper-registry.json` - All helper functions
- `engine-registry.json` - Core engines (rutine, deviation, etc.)
- `component-registry.json` - UI components
- `workflow-registry.json` - Development workflows
- `prompt-registry.json` - AI prompts
- `dependency-map.json` - Relationships between entities

### Usage
**Before creating new code:**
1. Check relevant registry
2. Search for existing implementation
3. Reuse or extend existing code
4. Only create new if absolutely necessary
5. Add to registry BEFORE implementing

## SCHEMAS

### Purpose
Define structure and validation rules for all entities.

### Files
- `helper.schema.json` - Helper function schema
- `engine.schema.json` - Engine schema
- `workflow.schema.json` - Workflow schema
- `prompt.schema.json` - Prompt schema
- `relationship.schema.json` - Dependency relationship schema

### Usage
All registry entries must conform to their schema.

## AGENTS

### Purpose
Rules and guidelines for AI agents (Windsurf, Codex, ChatGPT, Claude).

### Files
- `AGENT_START_RULES.md` - **READ THIS FIRST**
- `windsurf.rules.md` - Windsurf Cascade specific rules
- `codex.rules.md` - Codex specific rules

### Critical Rules
1. **No code before registry check**
2. **No new helper before helper audit**
3. **No duplicate logic**
4. **Reuse-first development**
5. **Minimal safe changes**
6. **Workflow-first thinking**
7. **Log decisions**

## WORKFLOWS

### Purpose
Standard processes for common development tasks.

### Files
- `feature.workflow.json` - Feature development
- `bugfix.workflow.json` - Bug fixing
- `deploy.workflow.json` - Deployment
- `refactor.workflow.json` - Refactoring

### Usage
**Before starting work:**
1. Find relevant workflow
2. Follow steps in order
3. Check all checkpoints
4. Document deviations
5. Update workflow if improved

## MEMORY

### Purpose
Persistent storage for knowledge, prompts, and procedures.

### Folders
- `knowledge/` - Project knowledge, architecture, decisions
- `prompts/` - Reusable AI prompts
- `operations/` - Operations procedures and checklists
- `ideas/` - Feature ideas and brainstorming
- `decisions/` - Decision logs with rationale

### Usage
Store in appropriate folder based on content type.
Use desktop-app modules for easy access.

## LOGS

### Purpose
Track fixes, decisions, and deployments.

### Files
- `fixes.log.json` - Bug fixes
- `decisions.log.json` - Development decisions
- `deployments.log.json` - Production deployments

### Format
```json
{
  "version": "1.0.0",
  "entries": [
    {
      "id": "timestamp",
      "date": "ISO date",
      "type": "fix|decision|deployment",
      "description": "...",
      "details": {},
      "tags": []
    }
  ]
}
```

## DESKTOP APP

### Purpose
Local UI for managing tools platform.

### Modules
- `knowledge.module.js` - Knowledge Base
- `prompts.module.js` - Prompt Library
- `operations.module.js` - Operations

### Usage
```bash
cd tools/desktop-app
node server.cjs
# Open http://localhost:3000
```

## DEVELOPMENT WORKFLOW

### 1. Before Coding
```
Read AGENT_START_RULES.md
↓
Check registries for existing code
↓
Check workflows for process
↓
Check memory for context
```

### 2. During Development
```
Follow reuse-first principles
↓
Make minimal changes
↓
Update registries if adding code
↓
Log decisions
```

### 3. After Development
```
Verify no duplicates
↓
Update registries
↓
Update workflows if improved
↓
Log completion
```

## REGISTRY UPDATE PROTOCOL

### Helper Function
1. Add entry to `helper-registry.json`
2. Document purpose, location, dependencies
3. Update `dependency-map.json`

### Engine
1. Add entry to `engine-registry.json`
2. Document Firestore collections
3. Document critical rules
4. Update `dependency-map.json`

### Component
1. Add entry to `component-registry.json`
2. Document UI dependencies
3. Update `dependency-map.json`

### Workflow
1. Add entry to `workflow-registry.json`
2. Document steps and verification

## CRITICAL AREAS

**Do not change without checking engine-registry.json:**
- Rutine engine (task_templates, task_instances)
- Canonical routine model (17 routine types)
- Persistent card logic (7-day window)
- Deviation engine
- prettyName resolver
- startDayForLocation

## PRINCIPLES

1. **Reuse First** - Always check for existing code
2. **Minimal Changes** - Change only what's necessary
3. **Document Everything** - Update registries and logs
4. **Follow Workflows** - Use standard processes
5. **Agent Rules** - Follow AI agent guidelines
6. **No Duplicates** - Single source of truth
7. **Dependencies Matter** - Understand relationships

## NEXT PHASE

After foundation is stable:
- Implement code scanners
- Build helper audit tool
- Add AI orchestration
- Integrate with Firebase
- Build dependency visualizer
- Add automated registry updates

## QUESTIONS?

1. **Where do I start?** - Read `agents/AGENT_START_RULES.md`
2. **How do I add code?** - Check registries first, then follow workflow
3. **How do I find existing code?** - Check registries and use grep
4. **How do I log decisions?** - Add to `logs/decisions.log.json`
5. **How do I use desktop app?** - `cd desktop-app && node server.cjs`

## REMEMBER

**The goal is NOT to write code.**  
**The goal is to SOLVE PROBLEMS with MINIMAL, SAFE changes.**

Use the foundation to:
- Find existing solutions
- Understand dependencies
- Make informed decisions
- Avoid breaking things
- Maintain consistency
