# Audit Checklist — run for every change

Before finishing any larger change, verify ALL of:

- [ ] **Active vs deprecated file** — editing the ACTIVE runtime file, not a deprecated/`*-v2` copy
      (cross-check `feature-registry.json` + the relevant `*.registry.md`).
- [ ] **Duplicate flow** — not creating a parallel save/provision/preview flow (reuse existing).
- [ ] **Hard-delete** — none introduced; deletes are soft-archive only.
- [ ] **Scope regression** — Supawan/Aroi-D canonical scope untouched; `mn@madkontrollen.dk` stays
      tenant-less (no companyId/locationId).
- [ ] **Actor fields** — "Udført af"/"Oprettet af" not "—"; missing actor → "Ikke registreret".
- [ ] **Equipment refs** — cold/freezer/temperature routines carry a concrete equipment unit; no
      generic "Fryser temperatur"/"Køleskab temperatur".
- [ ] **Deploy target** — hosting from clean-room `D:\mk-deploy-focused`; rules/functions need separate GO.
- [ ] **node --check** — passes on every changed JS file (and HTML inline scripts).
- [ ] **Rules brace check** — if `firestore.rules` changed: brace/paren/bracket balance OK + read/list
      not newly restricted + write/create/update not newly broadened without intent.
- [ ] **Registry updated** — the relevant `tools/*.registry.md` / `feature-registry.json` reflects the
      change (active/deprecated files, new collections, new no-go rules).

## Quick commands
```
# node --check an inline HTML script (extract + check)
node -e 'const fs=require("fs"),cp=require("child_process"),os=require("os");const h=fs.readFileSync(process.argv[1],"utf8");const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0;while((m=re.exec(h))){i++;const a=m[1]||"";if(/\bsrc=/.test(a))continue;const c=m[2];if(!c.trim())continue;const f=os.tmpdir()+"/c_"+i+(/type\s*=\s*["\x27]module/.test(a)?".mjs":".js");fs.writeFileSync(f,c);try{cp.execSync(JSON.stringify(process.execPath)+" --check "+JSON.stringify(f),{stdio:"pipe"});console.log("OK #"+i)}catch(e){console.log("FAIL #"+i+"\n"+e.stderr)}}' <file.html>

# rules brace balance
node -e 'const s=require("fs").readFileSync("firestore.rules","utf8");const b=(s.match(/{/g)||[]).length-(s.match(/}/g)||[]).length;const p=(s.match(/\(/g)||[]).length-(s.match(/\)/g)||[]).length;console.log("braces",b,"parens",p)'
```
