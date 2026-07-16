/**
 * Build Egenkontrol Program - Main assembler
 * Combines country, branch, and personalization layers into stable output
 */

import DK from '../config/countries/dk.js';
import IT from '../config/countries/it.js';
import Pizzeria from '../config/branches/pizzeria.js';
import Asiatisk from '../config/branches/asiatisk.js';
import Cafe from '../config/branches/cafe.js';
import Takeaway from '../config/branches/takeaway.js';
import { buildUnits } from './buildUnits.js';
import { buildPersonalisering } from './buildPersonalisering.js';
import { buildSkemaer } from './buildSkemaer.js';
import { buildProcedurer } from './buildProcedurer.js';

const COUNTRY_CONFIG = {
    DK,
    IT
};

const BRANCH_CONFIG = {
    pizzeria: Pizzeria,
    asiatisk_restaurant: Asiatisk,
    cafe: Cafe,
    takeaway: Takeaway
};

function normalizeCompanyType(companyType) {
    if (!companyType) return 'takeaway';
    
    const normalized = String(companyType).toLowerCase().trim();
    
    if (normalized.includes('pizza')) return 'pizzeria';
    if (normalized.includes('asiat') || normalized.includes('kines') || normalized.includes('thai')) return 'asiatisk_restaurant';
    if (normalized.includes('cafe') || normalized.includes('café')) return 'cafe';
    if (normalized.includes('takeaway') || normalized.includes('take away')) return 'takeaway';
    
    return 'takeaway';
}

export function buildEgenkontrolProgram(snapshot = {}) {
    const profile = snapshot.profile || {};
    
    // LAG 1: Country
    const country = (profile.country || 'DK').toUpperCase();
    const countryConfig = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.DK;
    
    // LAG 2: Branch
    const companyType = normalizeCompanyType(profile.companyType);
    const branchConfig = BRANCH_CONFIG[companyType] || BRANCH_CONFIG.takeaway;
    
    // LAG 3: Personalization
    const units = buildUnits(profile);
    const personalisering = buildPersonalisering(profile);
    
    // LAG 4: Assembly
    const skemaer = buildSkemaer(countryConfig, branchConfig, personalisering, units);
    const procedurer = buildProcedurer(countryConfig, branchConfig);
    
    // LAG 5: Stable output contract
    return {
        virksomhedsoplysninger: {
            navn: profile.companyName || profile.virksomhedsnavn || "",
            adresse: profile.address || profile.adresse || "",
            postnr: profile.postalCode || profile.postnr || "",
            by: profile.city || profile.by || "",
            cvr: profile.cvr || "",
            branche: companyType,
            country: country,
            language: profile.language || profile.defaultStaffLanguage || "da",
            produkter: branchConfig.productExamples || []
        },
        
        personalisering: personalisering,
        
        skemaer: skemaer,
        
        procedurer: procedurer,
        
        brancheSpecifikkeRisici: branchConfig.specificRisks || {},
        
        regulatoryProfile: {
            country: country,
            routineSet: countryConfig.routineSet,
            schemaVersion: 1
        },
        
        units: units,
        
        metadata: {
            generatedAt: new Date().toISOString(),
            generatorVersion: "1.0.0",
            countryConfigVersion: countryConfig.routineSet,
            branchKey: branchConfig.key
        }
    };
}

export function validateProgram(program) {
    const errors = [];
    
    if (!program.virksomhedsoplysninger) {
        errors.push("Missing virksomhedsoplysninger");
    }
    
    if (!program.skemaer || Object.keys(program.skemaer).length === 0) {
        errors.push("No schemas generated");
    }
    
    if (!program.procedurer || Object.keys(program.procedurer).length === 0) {
        errors.push("No procedures generated");
    }
    
    if (!program.regulatoryProfile) {
        errors.push("Missing regulatoryProfile");
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}
