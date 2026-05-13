# CODEX RULES

**Version:** 1.0.0  
**Last Updated:** 2026-05-11

## CODEX-SPECIFIC GUIDELINES

### STRENGTHS

Codex excels at:
- Inline code completion
- Quick fixes
- Boilerplate generation
- Syntax suggestions
- Local context assistance

### USE CODEX FOR

1. **Inline Assistance**
   - Auto-completion
   - Quick fixes
   - Variable naming
   - Function signatures

2. **Boilerplate**
   - Repetitive code
   - Standard patterns
   - Common structures

3. **Quick Edits**
   - Single-line changes
   - Simple refactors
   - Comment generation

### CODEX WORKFLOW

1. **Before accepting suggestion:**
   - Verify it follows existing patterns
   - Check for duplicates
   - Ensure it matches codebase style

2. **After accepting:**
   - Test immediately
   - Verify no breakage

### CODEX BEST PRACTICES

**DO:**
- Use for speed on simple tasks
- Verify suggestions before accepting
- Follow existing code patterns
- Use for repetitive work

**DON'T:**
- Blindly accept all suggestions
- Use for complex logic
- Use for architecture decisions
- Create duplicates

### CODEX LIMITATIONS

**Not ideal for:**
- Multi-file changes (use Windsurf)
- Complex refactoring (use Windsurf)
- Architecture design (use ChatGPT)
- Documentation (use Claude)

### INTEGRATION WITH WINDSURF

**Division of labor:**
- Codex: Inline assistance during coding
- Windsurf: Architecture, multi-file, complex logic

**Workflow:**
1. Windsurf plans and structures
2. Codex assists with implementation
3. Windsurf verifies and integrates

### VERIFICATION

After using Codex:

- [ ] Code follows existing patterns
- [ ] No duplicates created
- [ ] Tests pass
- [ ] Syntax is correct

### COMMON PITFALLS

**Avoid:**
- Accepting suggestions without review
- Using for complex logic
- Creating inconsistent code
- Ignoring existing helpers

### WHEN TO SWITCH TO WINDSURF

Switch from Codex to Windsurf when:
- Need multi-file context
- Complex logic required
- Architecture decisions needed
- Refactoring multiple files
- Debugging cross-file issues

**Know your tool's limits.**
