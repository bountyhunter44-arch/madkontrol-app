// === HERO AWNING INLINE SVG LOADER ===

async function loadHeroAwningInline(color) {
  const mount = document.getElementById("heroAwning");
  if (!mount) return;

  const resolvedColor = color || "#2f6d3a";

  if (!mount.dataset.loaded) {
    try {
      const res = await fetch("/images/awnings/awning-base.svg", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const svg = await res.text();
      mount.innerHTML = svg;
      mount.dataset.loaded = "true";
    } catch (err) {
      console.error("[awning] Failed to load awning SVG:", err);
      return;
    }
  }

  mount.style.color = resolvedColor;
}
