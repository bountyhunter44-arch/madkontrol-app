# WINDSURF CASCADE RULES

**Version:** 1.0.0  
**Last Updated:** 2026-05-11

## WINDSURF-SPECIFIC GUIDELINES

### STRENGTHS

Windsurf Cascade excels at:
- Full codebase context
- Multi-file edits
- Complex refactoring
- Dependency tracking
- Live debugging

### USE WINDSURF FOR

1. **Feature Development**
   - New modules
   - Multi-file changes
   - Complex logic
   - UI components

2. **Bug Fixing**
   - Root cause analysis
   - Cross-file debugging
   - Dependency issues

3. **Refactoring**
   - Code reorganization
   - Pattern extraction
   - Dependency cleanup

### WINDSURF WORKFLOW

1. **Start:**
   - Read AGENT_START_RULES.md
   - Check registries
   - Check workflows

2. **Develop:**
   - Use code_search for context
   - Make minimal changes
   - Test incrementally

3. **Finish:**
   - Update registries
   - Log decisions
   - Verify no breakage

### WINDSURF BEST PRACTICES

**DO:**
- Use code_search before editing
- Read existing code first
- Make targeted edits
- Test after each change
- Update documentation

**DON'T:**
- Make blind edits
- Change code without understanding
- Skip registry checks
- Ignore existing patterns
- Create duplicates

### WINDSURF PROMPTS

Store reusable prompts in:
- `tools/memory/prompts/windsurf/`

Example categories:
- Feature development
- Bug fixing
- Refactoring
- Deployment
- Testing

### WINDSURF MEMORY

Use `tools/memory/knowledge/` for:
- Architecture decisions
- Critical rules
- Known issues
- Best practices

### INTEGRATION WITH OTHER AGENTS

**Windsurf + Codex:**
- Windsurf for architecture/multi-file
- Codex for inline assistance

**Windsurf + ChatGPT:**
- Windsurf for implementation
- ChatGPT for brainstorming

**Windsurf + Claude:**
- Windsurf for code
- Claude for documentation/analysis

### VERIFICATION CHECKLIST

After Windsurf session:

- [ ] All edits are minimal and necessary
- [ ] No duplicate code created
- [ ] Registries updated
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Decisions logged

### COMMON PITFALLS

**Avoid:**
- Over-engineering solutions
- Changing too much at once
- Ignoring existing patterns
- Creating new helpers without checking
- Breaking existing dependencies

### EMERGENCY PROCEDURES

If Windsurf breaks something:

1. **Stop immediately**
2. Check `tools/registries/dependency-map.json`
3. Identify what broke
4. Revert changes
5. Log incident in `tools/logs/fixes.log.json`
6. Restart with smaller scope

### WINDSURF LIMITATIONS

**Not ideal for:**
- Simple text changes (use Codex)
- Marketing content (use ChatGPT)
- Documentation (use Claude)
- Data analysis (use ChatGPT)

**Know when to switch tools.**
