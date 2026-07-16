from pathlib import Path
import re
from datetime import datetime

p = Path("public/quick-onboarding.html")
if not p.exists():
    raise SystemExit("Filen findes ikke: public/quick-onboarding.html")

text = p.read_text(encoding="utf-8")
stamp = datetime.now().strftime("%Y%m%d%H%M%S")
backup = p.with_name(f"quick-onboarding.html.bak-modules-{stamp}")
backup.write_text(text, encoding="utf-8")

module_section = r'''
                <div class="form-section module-selection-section" id="moduleSelectionSection">
                    <h2>Vælg moduler</h2>
                    <p class="section-help">Vælg de moduler virksomheden skal starte med. Du kan altid tilføje flere senere.</p>

                    <div class="module-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:18px 0 8px;">
                        <label class="module-card" style="display:block;border:1px solid #dbe7d7;border-radius:16px;padding:16px;background:#fff;cursor:pointer;">
                            <input type="checkbox" name="selectedModules" value="egenkontrol" data-module-slug="egenkontrol" checked>
                            <strong style="display:block;margin-top:8px;">Egenkontrol</strong>
                            <span style="display:block;color:#667466;font-size:0.95rem;margin-top:4px;">Daglige rutiner, risikoanalyse og myndighedsrapport.</span>
                        </label>

                        <label class="module-card" style="display:block;border:1px solid #dbe7d7;border-radius:16px;padding:16px;background:#fff;cursor:pointer;">
                            <input type="checkbox" name="selectedModules" value="pos" data-module-slug="pos">
                            <strong style="display:block;margin-top:8px;">POS</strong>
                            <span style="display:block;color:#667466;font-size:0.95rem;margin-top:4px;">Kasse, salg, dagsafslutning og betaling.</span>
                        </label>

                        <label class="module-card" style="display:block;border:1px solid #dbe7d7;border-radius:16px;padding:16px;background:#fff;cursor:pointer;">
                            <input type="checkbox" name="selectedModules" value="lagerkontrol" data-module-slug="lagerkontrol">
                            <strong style="display:block;margin-top:8px;">Lagerkontrol</strong>
                            <span style="display:block;color:#667466;font-size:0.95rem;margin-top:4px;">Varer, optælling, varemodtagelse og svind.</span>
                        </label>

                        <label class="module-card" style="display:block;border:1px solid #dbe7d7;border-radius:16px;padding:16px;background:#fff;cursor:pointer;">
                            <input type="checkbox" name="selectedModules" value="menu" data-module-slug="menu">
                            <strong style="display:block;margin-top:8px;">Menu / Opskrifter</strong>
                            <span style="display:block;color:#667466;font-size:0.95rem;margin-top:4px;">Menuer, opskrifter, allergener og indhold.</span>
                        </label>

                        <label class="module-card" style="display:block;border:1px solid #dbe7d7;border-radius:16px;padding:16px;background:#fff;cursor:pointer;">
                            <input type="checkbox" name="selectedModules" value="seo" data-module-slug="seo">
                            <strong style="display:block;margin-top:8px;">SEO Automatik</strong>
                            <span style="display:block;color:#667466;font-size:0.95rem;margin-top:4px;">Lokale landingssider, synlighed og søgemaskineoptimering.</span>
                        </label>

                        <label class="module-card" style="display:block;border:1px solid #dbe7d7;border-radius:16px;padding:16px;background:#fff;cursor:pointer;opacity:.72;">
                            <input type="checkbox" name="selectedModules" value="accounting" data-module-slug="accounting" disabled>
                            <strong style="display:block;margin-top:8px;">Bogføringsapp</strong>
                            <span style="display:block;color:#667466;font-size:0.95rem;margin-top:4px;">Kommer snart.</span>
                        </label>
                    </div>
                </div>
'''

helper_js = r'''
        function getSelectedModules() {
            const checked = Array.from(document.querySelectorAll('input[name="selectedModules"]:checked'))
                .map((input) => (input.value || '').trim())
                .filter(Boolean);

            return checked.length ? checked : ['egenkontrol'];
        }

        function applyModuleSelectionFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const raw = [
                params.get('module'),
                params.get('modules')
            ].filter(Boolean).join(',');

            const requested = raw
                .split(',')
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean);

            if (!requested.length) return;

            const boxes = Array.from(document.querySelectorAll('input[name="selectedModules"][data-module-slug]'));
            if (!boxes.length) return;

            boxes.forEach((box) => {
                if (!box.disabled) box.checked = false;
            });

            requested.forEach((slug) => {
                const box = document.querySelector(`input[name="selectedModules"][data-module-slug="${slug}"]`);
                if (box && !box.disabled) box.checked = true;
            });

            if (!getSelectedModules().length) {
                const fallback = document.querySelector('input[name="selectedModules"][data-module-slug="egenkontrol"]');
                if (fallback && !fallback.disabled) fallback.checked = true;
            }
        }

        document.addEventListener('DOMContentLoaded', applyModuleSelectionFromUrl);

'''

changed = False

if 'data-module-slug="pos"' not in text:
    match = re.search(r'\n\s*<button\b[^>]*submitForm\(\)[^>]*>.*?</button>', text, flags=re.I | re.S)
    if not match:
        raise SystemExit("Kunne ikke finde submitForm-knappen. Stopper uden ændring.")
    text = text[:match.start()] + "\n" + module_section + text[match.start():]
    changed = True

if "function getSelectedModules()" not in text:
    marker = "        window.submitForm = async function()"
    if marker not in text:
        raise SystemExit("Kunne ikke finde window.submitForm. Stopper uden ændring.")
    text = text.replace(marker, helper_js + marker, 1)
    changed = True

if "selectedModules: getSelectedModules()" not in text:
    text2, n = re.subn(
        r'(\n\s*)setup(\s*[,\n}])',
        r'\1selectedModules: getSelectedModules(),\1setup\2',
        text,
        count=1
    )
    if n != 1:
        raise SystemExit("Kunne ikke indsætte selectedModules i payload. Stopper uden ændring.")
    text = text2
    changed = True

if "[Quick Onboarding] Payload:" in text and "selectedModules: getSelectedModules()" in text:
    text = text.replace(
        "console.log('[Quick Onboarding] Payload:', { cvr, email, companyName, contactPersonName, address, phone, industry, setup });",
        "console.log('[Quick Onboarding] Payload:', { cvr, email, companyName, contactPersonName, address, phone, industry, selectedModules: getSelectedModules(), setup });"
    )

p.write_text(text, encoding="utf-8")

print(f"Backup: {backup}")
print(f"Changed: {changed}")
print("OK: quick-onboarding.html patched with module selection")
