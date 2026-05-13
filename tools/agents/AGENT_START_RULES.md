# AGENT START RULES

**Version:** 1.0.0  
**Last Updated:** 2026-05-11

## CRITICAL RULES FOR ALL AI AGENTS

### 1. NO CODE BEFORE REGISTRY CHECK

Before writing ANY code:
- Check `tools/registries/helper-registry.json` for existing helpers
- Check `tools/registries/engine-registry.json` for existing engines
- Check `tools/registries/component-registry.json` for existing components
- Check `tools/registries/dependency-map.json` for relationships

**WHY:** Prevent duplicate logic and breaking existing dependencies.

### 2. NO NEW HELPER BEFORE HELPER AUDIT

Before creating a new helper function:
- Search codebase for similar functionality
- Check if existing helper can be extended
- Document why new helper is needed
- Add to helper-registry.json BEFORE implementing

**WHY:** Avoid helper proliferation and maintain DRY principles.

### 3. NO DUPLICATE LOGIC

Before implementing ANY logic:
- Search for existing implementation
- Reuse existing code
- If modification needed, update existing code (don't duplicate)
- Document decision in `tools/logs/decisions.log.json`

**WHY:** Single source of truth for all logic.

### 4. REUSE-FIRST DEVELOPMENT

Development priority:
1. **Reuse** existing code
2. **Extend** existing code
3. **Refactor** existing code
4. **Create** new code (LAST RESORT)

**WHY:** Minimize codebase complexity and maintenance burden.

### 5. MINIMAL SAFE CHANGES

When making changes:
- Change ONLY what is necessary
- Preserve existing behavior unless explicitly changing it
- Test before and after
- Document what changed and why

**WHY:** Reduce risk of breaking existing functionality.

### 6. WORKFLOW-FIRST THINKING

Before starting work:
- Check `tools/workflows/` for relevant workflow
- Follow workflow steps
- Document deviations
- Update workflow if improved

**WHY:** Consistent, repeatable processes.

### 7. LOG DECISIONS

After ANY significant decision:
- Log to `tools/logs/decisions.log.json`
- Include: what, why, alternatives considered, risks
- Reference in code comments if relevant

**WHY:** Maintain decision history and context.

## WORKFLOW CHECKLIST

Before starting ANY task:

- [ ] Read relevant agent rules (windsurf.rules.md, codex.rules.md)
- [ ] Check registries for existing code
- [ ] Check workflows for process
- [ ] Check logs for previous decisions
- [ ] Check memory for context

During task:

- [ ] Follow reuse-first development
- [ ] Make minimal safe changes
- [ ] Update registries if adding new code
- [ ] Log decisions

After task:

- [ ] Verify no duplicates created
- [ ] Update registries
- [ ] Update workflows if improved
- [ ] Log completion in appropriate log file

## REGISTRY UPDATE PROTOCOL

When adding new code:

1. **Helper Function:**
   - Add entry to `helper-registry.json`
   - Document purpose, location, dependencies
   - Update `dependency-map.json`

2. **Engine:**
   - Add entry to `engine-registry.json`
   - Document Firestore collections used
   - Document critical rules
   - Update `dependency-map.json`

3. **Component:**
   - Add entry to `component-registry.json`
   - Document UI dependencies
   - Update `dependency-map.json`

4. **Workflow:**
   - Add entry to `workflow-registry.json`
   - Document steps and verification

## CRITICAL "DO NOT CHANGE" AREAS

Before modifying these areas, STOP and check engine-registry.json for critical rules:

- Rutine engine (task_templates, task_instances creation)
- Canonical routine model (17 routine types)
- Persistent card logic (7-day window)
- Deviation engine
- prettyName resolver (priority order)
- startDayForLocation (demo template creation)

**WHY:** These areas have complex dependencies and critical business logic.

## ERROR RECOVERY

If you accidentally:

- Created duplicate code → Remove duplicate, update registry
- Broke dependency → Check dependency-map.json, restore
- Changed critical logic → Revert, check engine rules
- Skipped workflow → Document deviation, update workflow

## AGENT-SPECIFIC RULES

See:
- `windsurf.rules.md` - Rules for Windsurf Cascade
- `codex.rules.md` - Rules for Codex

## QUESTIONS TO ASK BEFORE CODING

1. Does this helper/function already exist?
2. Can I reuse existing code?
3. What dependencies will this create?
4. What could this break?
5. Is there a workflow for this?
6. What decision am I making and why?
7. How will I verify this works?

## REMEMBER

**The goal is NOT to write code.**  
**The goal is to SOLVE PROBLEMS with MINIMAL, SAFE changes.**

Registries, schemas, and workflows exist to help you:
- Find existing solutions
- Understand dependencies
- Make informed decisions
- Avoid breaking things
- Maintain consistency

**USE THEM.**
