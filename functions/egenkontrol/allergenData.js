/**
 * Officielle allergener og branchespecifik mapping
 * Baseret på EU-lovgivning om fødevareallergi-mærkning
 */

const OFFICIELLE_ALLERGENER = [
    { id: 'aeg', name: 'Æg', category: 'animalsk' },
    { id: 'maelk', name: 'Mælk', category: 'animalsk' },
    { id: 'krebsdyr', name: 'Krebsdyr', category: 'animalsk' },
    { id: 'bloeddyr', name: 'Bløddyr', category: 'animalsk' },
    { id: 'fisk', name: 'Fisk', category: 'animalsk' },
    { id: 'jordnoedder', name: 'Jordnødder', category: 'vegetabilsk' },
    { id: 'soja', name: 'Soja', category: 'vegetabilsk' },
    { id: 'sesam', name: 'Sesam', category: 'vegetabilsk' },
    { id: 'svovldioxid', name: 'Svovldioxid', category: 'tilsaetning' },
    { id: 'noedder', name: 'Nødder (f.eks. mandler, valnødder)', category: 'vegetabilsk' },
    { id: 'gluten', name: 'Glutenholdige kornprodukter (f.eks. hvede, rug)', category: 'vegetabilsk' },
    { id: 'selleri', name: 'Selleri', category: 'vegetabilsk' },
    { id: 'sennep', name: 'Sennep', category: 'vegetabilsk' },
    { id: 'lupin', name: 'Lupin', category: 'vegetabilsk' }
];

const ALLERGEN_HAANDTERING_TEKST = `Allergener håndteres som en del af risikoanalyse og produktadskillelse. Der arbejdes med tydelig mærkning, adskilt opbevaring og korrekt information til kunder.`;

const ALLERGEN_OPLYSNINGSPLIGT = `Disse allergener skal altid oplyses, når du serverer mad, enten skriftligt på en menu eller via information, der er tilgængelig, når du bliver spurgt.`;

// Branchespecifikke produkter med allergener
const BRANCH_ALLERGENIC_PRODUCTS = {
    pizzeria: {
        produkter: "Pizza, Pasta, Lasagne, Calzone, Salater, Desserter",
        typiske_allergener: ['gluten', 'maelk', 'aeg', 'noedder', 'selleri', 'sennep'],
        produktkategorier: "Kød, Ost, Grøntsager, Saucer, Varme retter, Desserter",
        eksempler: "Pizza margherita, Pizza speciale, Spaghetti carbonara, Lasagne, Tiramisu"
    },
    asiatisk_restaurant: {
        produkter: "Stegt ris, Nudler, Forårsruller, Wok-retter, Supper, Desserter",
        typiske_allergener: ['gluten', 'aeg', 'jordnoedder', 'sesam', 'fisk', 'krebsdyr', 'bloeddyr', 'soja'],
        produktkategorier: "Kød, Fisk, Skaldyr, Grøntsager, Ris, Nudler, Saucer, Varme retter",
        eksempler: "Stegt ris, Forårsruller, Pad Thai, Wok med kylling, Tom Yum suppe"
    },
    cafe: {
        produkter: "Sandwich, Salater, Bagværk, Kager, Smoothies, Kaffe, Panini, Quiche",
        typiske_allergener: ['gluten', 'maelk', 'aeg', 'noedder', 'sesam', 'sennep', 'selleri'],
        produktkategorier: "Brød, Pålæg, Ost, Grøntsager, Salater, Bagværk, Desserter",
        eksempler: "Sandwich med skinke og ost, Cæsarsalat, Croissant, Brownie, Quiche"
    },
    takeaway: {
        produkter: "Burger, Kebab, Pølser, Pizza, Pommes frites, Salater, Wraps",
        typiske_allergener: ['gluten', 'maelk', 'aeg', 'sesam', 'sennep', 'selleri', 'soja'],
        produktkategorier: "Kød, Fisk, Grøntsager, Saucer, Varme retter, Pommes frites, Desserter",
        eksempler: "Burger med ost, Kebab med pita, Hotdog, Pizza, Wrap med kylling"
    }
};

function getAllergenicProductsForBranch(branchType) {
    const normalized = normalizeCompanyType(branchType);
    const branchData = BRANCH_ALLERGENIC_PRODUCTS[normalized] || BRANCH_ALLERGENIC_PRODUCTS.takeaway;
    
    return {
        produkter: branchData.produkter,
        produktkategorier: branchData.produktkategorier,
        eksempler: branchData.eksempler,
        allergener: branchData.typiske_allergener.map(id => 
            OFFICIELLE_ALLERGENER.find(a => a.id === id)?.name || id
        ).join(', '),
        allergenHaandtering: ALLERGEN_HAANDTERING_TEKST,
        allergenOplysningspligt: ALLERGEN_OPLYSNINGSPLIGT
    };
}

function normalizeCompanyType(companyType) {
    if (!companyType) return 'takeaway';
    const normalized = String(companyType).toLowerCase().trim();
    if (normalized.includes('pizza')) return 'pizzeria';
    if (normalized.includes('asiat') || normalized.includes('kines') || normalized.includes('thai')) return 'asiatisk_restaurant';
    if (normalized.includes('cafe') || normalized.includes('café')) return 'cafe';
    if (normalized.includes('takeaway') || normalized.includes('take away')) return 'takeaway';
    return 'takeaway';
}

module.exports = {
    OFFICIELLE_ALLERGENER,
    ALLERGEN_HAANDTERING_TEKST,
    ALLERGEN_OPLYSNINGSPLIGT,
    BRANCH_ALLERGENIC_PRODUCTS,
    getAllergenicProductsForBranch
};
