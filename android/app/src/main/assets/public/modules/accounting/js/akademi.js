/**
 * Dette HTML-dokument udgør en komplet side for "Madkontrollen Pro Akademi", et læringsmodul til onboarding, træning og dokumentation for medarbejdere i fødevarebranchen.
 *
 * Funktionalitet og struktur:
 * - Responsivt layout med moderne CSS-variabler og grid.
 * - Hero-sektion med introduktion og statistik over kurser, gennemførsel, certifikater og manglende træning.
 * - Værktøjslinje med søgefelt og filtre til at sortere kursusbiblioteket efter kategori, niveau og status.
 * - Overblik-sektion med nøgletal for tildelte forløb, beståede quizzer, godkendte SOP’er og træning der snart skal fornyes.
 * - Kursusbibliotek med kursuskort, der viser status, fremdrift og handlinger for hvert kursus.
 * - Sektioner for næste anbefalede træning og seneste aktivitet.
 * - Læringsspor for forskellige roller (nye medarbejdere, køkken/produktion, ledere).
 * - FAQ-sektion med ofte stillede spørgsmål, hvor kun ét spørgsmål kan være åbent ad gangen.
 * - Dynamisk indlæsning af header og sidebar via fetch fra eksterne HTML-komponenter.
 * - JavaScript-funktioner til:
 *   * Dynamisk filtrering af kursuskort baseret på brugerens input og valg.
 *   * Visning af tom-tilstand, hvis ingen kurser matcher filtrene.
 *   * Interaktiv FAQ, hvor brugeren kan åbne/lukke spørgsmål.
 *   * Markering af aktivt menupunkt i sidebar/navigation.
 *
 * Teknologier:
 * - HTML5, CSS3 (med variabler og media queries for responsivitet)
 * - Vanilla JavaScript til DOM-manipulation og event handling
 * - Eksterne komponenter indlæses asynkront for genbrug og modularitet
 *
 * Sprog:
 * - Alt indhold og brugerflade er på dansk.
 *
 * Brug:
 * - Siden er beregnet til at blive brugt som en del af et større webapplikationsmodul, hvor brugeren kan navigere, filtrere og interagere med kursusindhold og træningsdata.
 */
async function loadAkademiSharedPartials(activePath = "") {
    const mounts = [
        { id: "headerMount", path: "/components/header.html" },
        { id: "sidebarMount", path: "/components/sidebar.html" }
    ];

    await Promise.all(
        mounts.map(async (item) => {
            const mount = document.getElementById(item.id);
            if (!mount) return;

            try {
                const response = await fetch(item.path, { cache: "no-store" });
                if (!response.ok) {
                    throw new Error("Kunne ikke hente " + item.path);
                }
                mount.innerHTML = await response.text();
            } catch (error) {
                console.warn(error);
            }
        })
    );

    if (activePath) {
        const activeLink = document.querySelector(`.sidebar a[href="${activePath}"]`);
        if (activeLink) activeLink.classList.add("active");
    }
}

function normalizeValue(value) {
    return (value || "").toLowerCase().trim();
}

function setupCollectionFilters({
    cardSelector,
    emptyStateId,
    searchInputId,
    searchFields = [],
    filters = []
}) {
    const cards = [...document.querySelectorAll(cardSelector)];
    const emptyState = document.getElementById(emptyStateId);
    const searchInput = searchInputId ? document.getElementById(searchInputId) : null;

    const filterElements = filters.map((filter) => ({
        ...filter,
        element: document.getElementById(filter.id)
    }));

    function applyFilters() {
        const searchValue = searchInput ? normalizeValue(searchInput.value) : "";
        let visibleCount = 0;

        cards.forEach((card) => {
            const matchesSearch =
                !searchValue ||
                searchFields.some((field) =>
                    normalizeValue(card.dataset[field]).includes(searchValue)
                );

            const matchesSelects = filterElements.every((filter) => {
                if (!filter.element) return true;

                const selected = normalizeValue(filter.element.value);
                if (selected === "all") return true;

                const cardValue = normalizeValue(card.dataset[filter.datasetKey]);
                return cardValue === selected;
            });

            const visible = matchesSearch && matchesSelects;
            card.style.display = visible ? "" : "none";

            if (visible) visibleCount++;
        });

        if (emptyState) {
            emptyState.style.display = visibleCount === 0 ? "block" : "none";
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    filterElements.forEach((filter) => {
        if (!filter.element) return;
        filter.element.addEventListener("input", applyFilters);
        filter.element.addEventListener("change", applyFilters);
    });

    applyFilters();
}

function setupFaqAccordion() {
    const faqItems = document.querySelectorAll(".faq-item");

    faqItems.forEach((item) => {
        const btn = item.querySelector(".faq-btn");
        if (!btn) return;

        btn.addEventListener("click", () => {
            const isOpen = item.classList.contains("open");

            faqItems.forEach((other) => {
                other.classList.remove("open");
                const icon = other.querySelector(".faq-btn span:last-child");
                if (icon) icon.textContent = "+";
            });

            if (!isOpen) {
                item.classList.add("open");
                const icon = item.querySelector(".faq-btn span:last-child");
                if (icon) icon.textContent = "−";
            }
        });
    });
}
