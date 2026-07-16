/**
 * Test file for riskToRoutineTransformer
 * Demonstrates the transformation from riskCards to routineTemplates
 */

import { buildRoutineCardsFromRiskCards } from './riskToRoutineTransformer.js';

// Example risk cards from the system
const exampleRiskCards = [
  {
    id: "micro_ccp_receiving_cold_chain",
    section: "Mikrobiologiske sundhedsfarer",
    type: "CCP",
    title: "Ved modtagelse af kølekrævende fødevarer",
    description: "Ved modtagelse af kølekrævende fødevarer skal det sikres...",
    products: "Forudproduceret mad, rester, varme retter...",
    ingredients: "Pasteuriserede æg, Varmebehandlet kød...",
    controls: "Varemodtagelse"
  },
  {
    id: "micro_ccp_cold_storage",
    section: "Mikrobiologiske sundhedsfarer",
    type: "CCP",
    title: "Kold opbevaring af fødevarer",
    description: "Når fødevarer bliver opbevaret koldt, hæmmes bakteriers vækst...",
    products: "Forudproduceret mad, rester, varme retter...",
    ingredients: "Pasteuriserede æg, Varmebehandlet kød, fisk, pålæg...",
    controls: "Køleskab 1 (+5), Køleskab 2 (+5), Køleskab 3 (+5), Lille displaykøleskab (+5)"
  },
  {
    id: "micro_gag_frost_storage",
    section: "Mikrobiologiske sundhedsfarer",
    type: "GAG",
    title: "Frostopbevaring og modtagelse af frostvarer",
    description: "Når frostvarer bliver opbevaret eller modtaget...",
    products: "Forudproduceret mad, rester, varme retter...",
    ingredients: "Frosne råvarer, Frosne bær",
    controls: "Display fryser (-18), Skuffefryser (-18), Kummefryser (-18), Varemodtagelse"
  },
  {
    id: "micro_ccp_heat_treatment",
    section: "Mikrobiologiske sundhedsfarer",
    type: "CCP",
    title: "Opvarmning / varmebehandling af fødevarer",
    description: "Risiko for tilstedeværelse af sygdomsfremkaldende bakterier...",
    products: "Forudproduceret mad, rester, varme retter...",
    ingredients: "Pasteuriserede æg, Rå fisk og skaldyr...",
    controls: "Varmebehandling af fødevarer, Genopvarmning af fødevarer"
  },
  {
    id: "micro_ccp_hot_holding",
    section: "Mikrobiologiske sundhedsfarer",
    type: "CCP",
    title: "Varmholdelse",
    description: "Der er risiko for vækst af sygdomsfremkaldende bakterier...",
    products: "Varme retter, Suppe, Gryderetter",
    ingredients: "Rå æg, Pasteuriserede æg, Råt kød...",
    controls: "Varmholdelse (+65)"
  },
  {
    id: "micro_ccp_cooling",
    section: "Mikrobiologiske sundhedsfarer",
    type: "CCP",
    title: "Nedkøling af fødevarer",
    description: "Der er risiko for vækst af sygdomsfremkaldende bakterier...",
    products: "Forudproduceret mad, Rester",
    ingredients: "Pasteuriserede æg, Rå fisk og skaldyr...",
    controls: "Nedkøling af fødevarer"
  },
  {
    id: "micro_gag_cleaning_equipment",
    section: "Mikrobiologiske sundhedsfarer",
    type: "GAG",
    title: "Rengøring og desinfektion af udstyr",
    description: "Rengøring og desinfektion af produktionsudstyr...",
    products: "Forudproduceret mad, rester, varme retter...",
    ingredients: "Pasteuriserede æg, Rå fisk og skaldyr...",
    controls: "Skyllevand opvaskemaskine (+80)"
  }
];

// Run transformation
console.log("=== RISK TO ROUTINE TRANSFORMATION TEST ===\n");
console.log(`Input: ${exampleRiskCards.length} risk cards\n`);

const routineTemplates = buildRoutineCardsFromRiskCards(exampleRiskCards);

console.log(`Output: ${routineTemplates.length} routine templates\n`);
console.log("=== GENERATED ROUTINE TEMPLATES ===\n");
console.log(JSON.stringify(routineTemplates, null, 2));

// Summary by type
const byType = routineTemplates.reduce((acc, r) => {
  acc[r.taskType] = (acc[r.taskType] || 0) + 1;
  return acc;
}, {});

console.log("\n=== SUMMARY BY TASK TYPE ===");
console.log(byType);

// Summary by frequency
const byFrequency = routineTemplates.reduce((acc, r) => {
  acc[r.frequency] = (acc[r.frequency] || 0) + 1;
  return acc;
}, {});

console.log("\n=== SUMMARY BY FREQUENCY ===");
console.log(byFrequency);
