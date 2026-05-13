  
  return limits.length > 0 ? limits.join("\n\n") : null;
}

function formatCorrectiveActions(kcp) {
  if (!kcp || !kcp.correctiveAction) return null;
  
  const actions = [];
  const correctiveAction = kcp.correctiveAction;
  
  if (correctiveAction.immediate) {
    actions.push(`**Øjeblikkelig handling:** ${correctiveAction.immediate}`);
  }
  
  if (correctiveAction.prevention) {
    actions.push(`**Forebyggelse:** ${correctiveAction.prevention}`);
  }
  
  if (correctiveAction.documentation) {
    actions.push(`**Dokumentation:** ${correctiveAction.documentation}`);
  }
  
  Object.entries(correctiveAction).forEach(([key, value]) => {
    if (value && typeof value === "string" && !["immediate", "prevention", "documentation", "training"].includes(key)) {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      actions.push(`**${label}:** ${value}`);
    }
  });
  
  return actions.length > 0 ? actions.join("\n\n") : null;
}

function buildSpecificGuideContent(kcp) {
  const category = (kcp?.category || "").toLowerCase();
  const title = (kcp?.title || "").toLowerCase();
  
  if (category.includes("nedkoeling") || title.includes("nedkøl")) {
    return {
      guidePurpose: "At sikre at tilberedte retter nedkøles hurtigt nok til at forhindre bakterievækst. Langsom nedkøling mellem 10°C og 60°C er farligt.",
      guideExecutionTimes: "Efter hver tilberedning af retter der skal opbevares køligt",
      guideCriticalLimit: "Sluttemperatur under 10°C inden for 4 timer fra 60°C",
      guideSteps: [
        "Mål og noter starttemperatur umiddelbart efter tilberedning (skal være under 60°C)",
        "Placer maden i blast chiller eller køl med god luftcirkulation",
        "Tildæk maden korrekt og mærk med dato og tidspunkt",
        "Mål sluttemperatur efter nedkøling",
        "Registrér både start- og sluttemperatur samt nedkølingstid i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslæt for start", "Starttemperatur", "Sluttemperatur", "Nedkølingstid", "Hvem der har udført kontrollen", "Eventuel kommentar"],
      guideApproval: ["Sluttemperatur er under 10°C", "Nedkøling tog mindre end 4 timer", "Maden er korrekt tildækket og mærket", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Sluttemperatur over 10°C efter 4 timer", "Blast chiller fungerer ikke", "Maden blev ikke tildækket korrekt", "Nedkølingstid overskred 4 timer"],
      guideIfNotOk: [
        "Registrér afvigelsen straks med præcise temperaturer og tidspunkter",
        "Hvis over 10°C efter 4 timer: Kassér maden omgående - bakterievækst kan være farlig",
        "Hvis blast chiller defekt: Brug isvandsbad eller fordel i mindre portioner i køl",
        "Flyt andre varer til fungerende udstyr",
        "Informér køkkenchef eller ansvarlig leder",
        "Bestil service på blast chiller hvis nødvendigt",
        "Ved tvivl om fødevaresikkerhed: Kassér altid maden"
      ],
      guideShortTips: ["Mål altid roligt og korrekt", "Brug kalibreret termometer", "Skriv den rigtige temperatur, ikke et gæt", "Ved afvigelse skal du altid handle med det samme", "Dokumentér alt"]
    };
  }
  
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return {
      guidePurpose: "At sikre at maden tilberedes korrekt til en sikker temperatur for at forhindre bakterievækst.",
      guideExecutionTimes: "Før hver servering af tilberedte retter",
      guideCriticalLimit: "Kernetemperatur på minimum 75°C",
      guideSteps: [
        "Stik termometeret i den tykkeste del af kødet eller fjerkræet",
        "Vent 10 sekunder for at få en stabil måling",
        "Aflæs temperaturen og sikr dig at den er minimum 75°C",
        "Registrér temperaturen i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslæt for måling", "Kernetemperatur", "Hvem der har udført kontrollen", "Eventuel kommentar"],
      guideApproval: ["Kernetemperatur er minimum 75°C", "Maden ser appetitlig ud", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Kernetemperatur under 75°C", "Termometeret er ikke kalibreret", "Maden ser ikke appetitlig ud"],
      guideIfNotOk: [
        "Registrér afvigelsen straks med præcise temperaturer og tidspunkter",
        "Hvis under 75°C: Tilbered maden længere ved lavere varme",
        "Hvis termometeret ikke er kalibreret: Kalibrér det før næste brug",
        "Hvis maden ikke ser appetitlig ud: Kassér den",
        "Informér køkkenchef eller ansvarlig leder",
        "Ved tvivl om fødevaresikkerhed: Kassér altid maden"
      ],
      guideShortTips: ["Brug altid et kalibreret termometer", "Mål kernetemperaturen korrekt", "Skriv den rigtige temperatur, ikke et gæt", "Ved afvigelse skal du altid handle med det samme", "Dokumentér alt"]
    };
  }
  
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return {
      guideAreas: ["Temperatur (min 60°C)", "Varighed (max 3 timer)", "Madkvalitet"],
      guideSteps: ["Mål i midten af retten", "Tjek varmeskab temperatur", "Noter starttidspunkt", "Registrer data"],
      guideApproval: ["Minimum 60°C", "Under 3 timer", "Ser appetitlig ud"],
      guideIfNotOk: ["Under 60°C: Varm til 75°C eller kassér", "Over 3 timer: Kassér maden", "Varmeskab defekt: Flyt eller server", "Ved tvivl: Kassér", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("modtagelse") || title.includes("modtagelse")) {
    return {
      guideAreas: ["Temperatur (køl max 5°C, frost max -12°C)", "Emballage-integritet", "Holdbarhedsdato", "Sensorisk vurdering"],
      guideSteps: ["Tjek temperaturer", "Inspicer emballage", "Tjek datoer", "Lugt og se på varerne"],
      guideApproval: ["Temperaturer OK", "Emballage intakt", "Datoer acceptable", "Frisk lugt og udseende"],
      guideIfNotOk: ["Kølevarer over 5°C: Afvis", "Frostvarer optøede: Afvis", "Beskadiget emballage: Afvis eller dokumenter", "Dårlig lugt: Afvis altid", "Kort holdbarhed: Afvis eller brug samme dag", "Dokumenter med billeder"]
    };
  }
  
  if (category.includes("opbevaring") || title.includes("lager")) {
    return {
      guideAreas: ["Temperatur (køl 0-5°C, frost -18 til -25°C)", "FIFO-princip", "Adskillelse råt/tilberedt", "Tildækning og mærkning"],
      guideSteps: ["Mål temperaturer", "Tjek FIFO", "Kontrollér adskillelse", "Verificer mærkning"],
      guideApproval: ["Temperaturer korrekte", "FIFO overholdt", "Ingen krydskontaminering", "Alt mærket"],
      guideIfNotOk: ["Høj temperatur: Tjek døre, kontakt tekniker", "Råt over tilberedt: Flyt og rengør", "Umærket: Mærk nu eller kassér", "Gammelt mad: Kassér", "Gentagne problemer: Tag ud af drift", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("allergen")) {
    return {
      guideAreas: ["Allergenmærkning på menukort", "Separate redskaber", "Rengøring mellem retter", "Personaleviden"],
      guideSteps: ["Gennemgå menukort", "Tjek separate redskaber", "Test personaleviden", "Kontrollér rengøring"],
      guideApproval: ["Alt mærket korrekt", "Separate redskaber findes", "Personale kender allergener", "Rengøring forhindrer krydskontaminering"],
      guideIfNotOk: ["Mangler mærkning: Opdater omgående", "Personale ukyndigt: Hold briefing nu", "Ingen separate redskaber: Anskaf eller vask grundigt", "Krydskontaminering: Kassér og lav ny", "Allergisk reaktion: Ring 112 hvis alvorligt", "Træn personale"]
    };
  }
  
  if (category.includes("rengoering") || category.includes("cleaning")) {
    return {
      guideAreas: ["Arbejdsflader og redskaber", "Køle/frostenheder", "Afløb og gulve", "Maskiner"],
      guideSteps: ["Inspicer visuelt", "Tjek kritiske områder", "Verificer rengøringsplan", "Test med hvid klud"],
      guideApproval: ["Visuelt rent", "Ingen dårlig lugt", "Plan fulgt", "Hvid klud-test OK"],
      guideIfNotOk: ["Synligt snavs: Rengør omgående", "Afløb lugter: Rens dagligt", "Beskidte tætninger: Rengør og desinficer", "Maskiner urene: Stop brug og rengør", "Gentagne problemer: Ekstra instruktion", "Skadedyr: Kontakt bekæmpelse", "Registrer afvigelse"]
    };
  }
  
  return {
    guideAreas: ["Kontrollér visuelt", "Bekræft udførelse", "Beskriv afvigelser"],
    guideSteps: ["Vask hænder", "Gennemfør kontrol", "Gem dokumentation"],
    guideApproval: ["Rent og vedligeholdt", "Udført uden mangler", "Gemt i systemet"],
    guideIfNotOk: ["Registrér afvigelse", "Udfør korrigerende handling", "Informer ansvarlig"]
  };
}

function buildProvisionedTaskTemplates({ companyId, locationId, profile = {}, riskModel = {}, userId = "", userEmail = "" }) {
  const suppliers = sanitizeStringList(riskModel?.suppliers || profile?.suppliers || [], 20, 120);
  const nowIso = new Date().toISOString();
  
  // Generate scenario-based HACCP (new motor)
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: profile,
    companyType: profile.companyType
  });
  
  // Use scenario-based task templates if available
  const scenarioTasks = scenarioHaccp.taskTemplates || [];
  
  if (scenarioTasks.length > 0) {
    // Use new scenario-based templates
    return scenarioTasks.map((task, index) => {
      const templateId = task.id || toDocSafeId(`${companyId}__${locationId}__${task.sourceType}_${task.title}`).slice(0, 120);
      
      // Robust fallback for fields and alertRules
      const taskFields = Array.isArray(task.fields) && task.fields.length > 0 
        ? task.fields 
        : buildProvisionedTemplateFields(task.formType, suppliers);
      
      const taskAlertRules = Array.isArray(task.alertRules) && task.alertRules.length > 0 
        ? task.alertRules 
        : buildProvisionedTemplateAlertRules(task.formType, task.title, task.riskLevel);
      
      // Defensive defaults for objects/arrays
      const safeCriticalLimits = task.criticalLimits && typeof task.criticalLimits === "object" 
        ? task.criticalLimits 
        : {};
      
      const safeProcedure = Array.isArray(task.procedure) 
        ? task.procedure 
        : [];
      
      const safeDeviationActions = Array.isArray(task.deviationActions) 
        ? task.deviationActions 
        : [];
      
      return {
        id: templateId,
        companyId,
        organizationId: companyId,
        locationId,
        title: sanitizeString(task.title, 220),
        description: sanitizeString(task.description, 500),
        category: sanitizeString(task.category, 80),
        frequency: task.frequency || task.frequencyType || "daily",
        frequencyType: task.frequencyType || "daily",
        frequencyDays: task.frequencyDays || 1,
        registrationFrequency: task.registrationFrequency || task.frequency || "daily",
        registrationFrequencyType: task.registrationFrequencyType || task.frequencyType || "daily",
        registrationFrequencyDays: task.registrationFrequencyDays || task.frequencyDays || 1,
        riskLevel: sanitizeString(task.riskLevel, 40) || "medium",
        isCCP: task.isCCP || false,
        controlPoint: sanitizeString(task.controlPoint, 180),
        controlPointType: sanitizeString(task.controlPointType, 80),
        formType: sanitizeString(task.formType, 40) || "checklist",
        fields: taskFields,
        alertRules: taskAlertRules,
        sourceHazardId: task.sourceHazardId,
        sourceHazard: task.sourceHazard,
        sourceProcessKey: task.sourceProcessKey,
        sourceType: task.sourceType || "hazard",
        templateType: task.templateType || "operational",
        templateSource: "scenario_based_haccp",
        haccpVersion: scenarioHaccp.version || "3.0_scenario_based",
        criticalLimits: safeCriticalLimits,
        procedure: safeProcedure,
        deviationActions: safeDeviationActions,
        active: task.active !== false,
        isActive: task.isActive !== false,
        createdBy: userId,
        createdByName: userEmail,
        updatedBy: userId,
        generatedAt: nowIso,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        relatedProcessKeys: Array.isArray(task.relatedProcessKeys) ? task.relatedProcessKeys : [],
        relatedHazardIds: Array.isArray(task.relatedHazardIds) ? task.relatedHazardIds : []
      };
    });
  }
  
  // Fallback to legacy KCP-based templates
  const comprehensiveHaccp = generateComprehensiveHaccp({
    profile: profile,
    companyType: profile.companyType
  });
  
  const kcpTasks = generateTaskTemplatesFromKcps(comprehensiveHaccp.kcps);
  
  return kcpTasks.map((task, index) => {
    const templateId = toDocSafeId(`${companyId}__${locationId}__kcp_${task.kcpNumber}_${task.title}`).slice(0, 120);
    
    // Find the corresponding KCP for detailed information
    const kcp = comprehensiveHaccp.kcps.find(k => k.id === task.kcpId);
    
    // Extract temperature limits if this is a temperature task
    const tempLimits = task.formType === "temperature" ? extractTemperatureLimits(kcp) : {};
    
    // Format instructions and corrective actions
    const instructions = kcp ? formatInstructions(kcp) : null;
    const criticalLimits = kcp ? formatCriticalLimits(kcp) : null;
    const correctiveActions = kcp ? formatCorrectiveActions(kcp) : null;
    
    // Get specific guide content based on KCP type
    const specificGuide = kcp ? buildSpecificGuideContent(kcp) : null;
    
    const baseTemplate = {
      id: templateId,
      companyId,
      organizationId: companyId,
      locationId,
      title: sanitizeString(task.title, 220),
      description: sanitizeString(task.description, 500),
      category: sanitizeString(task.category, 80),
      frequency: task.frequency || "daily",
      frequencyType: task.frequency || "daily",
      frequencyDays: task.frequency === "weekly" ? 7 : task.frequency === "monthly" ? 30 : 1,
      registrationFrequency: task.frequency || "daily",
      registrationFrequencyType: task.frequency || "daily",
      registrationFrequencyDays: task.frequency === "weekly" ? 7 : task.frequency === "monthly" ? 30 : 1,
      riskLevel: sanitizeString(task.riskLevel, 40) || "medium",
      controlPoint: sanitizeString(task.controlPoint, 180),
      formType: sanitizeString(task.formType, 40) || "checklist",
      fields: buildProvisionedTemplateFields(task.formType, suppliers),
      alertRules: buildProvisionedTemplateAlertRules(task.formType, task.title, task.riskLevel),
      kcpNumber: task.kcpNumber,
      kcpId: sanitizeString(task.kcpId, 120),
      isVerification: task.isVerification === true,
      sourceHazard: sanitizeString(task.controlPoint, 180),
      sourceType: "kcp_comprehensive_haccp",
      haccpVersion: "2.0_comprehensive",
      active: true,
      isActive: true,
      createdBy: userId,
      createdByName: userEmail,
      updatedBy: userId,
      generatedAt: nowIso,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Add temperature limits if applicable
    if (tempLimits.minValue !== null && tempLimits.minValue !== undefined) {
      baseTemplate.minValue = tempLimits.minValue;
    }
    if (tempLimits.maxValue !== null && tempLimits.maxValue !== undefined) {
      baseTemplate.maxValue = tempLimits.maxValue;
    }
    if (tempLimits.unit) {
      baseTemplate.measurementUnit = tempLimits.unit;
    }
    if (tempLimits.target) {
      baseTemplate.measurementTarget = tempLimits.target;
    }
    if (tempLimits.timeLimit) {
      baseTemplate.timeLimit = tempLimits.timeLimit;
    }
    
    // Add instructions and guidance
    if (instructions) {
      baseTemplate.instructions = instructions;
    }
    if (criticalLimits) {
      baseTemplate.criticalLimitsText = criticalLimits;
    }
    if (correctiveActions) {
      baseTemplate.correctiveActionsText = correctiveActions;
    }
    
    // Add hazard information from KCP
    if (kcp && kcp.hazard) {
      baseTemplate.hazardInfo = kcp.hazard;
    }
    
    // Add regulatory reference
    if (kcp && kcp.regulatoryReference) {
      baseTemplate.regulatoryReference = kcp.regulatoryReference;
    }
    
    // Add specific guide content
    if (specificGuide) {
      if (specificGuide.guidePurpose) {
        baseTemplate.guidePurpose = specificGuide.guidePurpose;
      }
      if (specificGuide.guideExecutionTimes) {
        baseTemplate.guideExecutionTimes = specificGuide.guideExecutionTimes;
      }
      if (specificGuide.guideCriticalLimit) {
        baseTemplate.guideCriticalLimit = specificGuide.guideCriticalLimit;
      }
      if (specificGuide.guideAreas) {
        baseTemplate.guideAreas = specificGuide.guideAreas;
      }
      if (specificGuide.guideSteps) {
        baseTemplate.guideSteps = specificGuide.guideSteps;
      }
      if (specificGuide.guideWhatToRegister) {
        baseTemplate.guideWhatToRegister = specificGuide.guideWhatToRegister;
      }
      if (specificGuide.guideApproval) {
        baseTemplate.guideApproval = specificGuide.guideApproval;
      }
      if (specificGuide.guideDeviationCriteria) {
        baseTemplate.guideDeviationCriteria = specificGuide.guideDeviationCriteria;
      }
      if (specificGuide.guideIfNotOk) {
        baseTemplate.guideIfNotOk = specificGuide.guideIfNotOk;
      }
      if (specificGuide.guideShortTips) {
        baseTemplate.guideShortTips = specificGuide.guideShortTips;
      }
      baseTemplate.guideEnabled = true;
    }
    
    return baseTemplate;
  });
}

async function ensureLiveTaskTemplatesForProvisioning({ companyId, locationId, profile, riskModel, userId, userEmail }) {
  const templates = buildProvisionedTaskTemplates({
    companyId,
    locationId,
    profile,
    riskModel,
    userId,
    userEmail
  });

  if (!templates.length) {
    return { created: 0 };
  }

  await Promise.all(templates.map((template) => db.collection("task_templates").doc(template.id).set(template, { merge: true })));
  return { created: templates.length };
}

function getComparableEpoch(item = {}) {
  const epoch = Number(item?.createdAtEpochMs || item?.updatedAtEpochMs || 0);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;

  const iso = sanitizeString(item?.createdAtIso || item?.updatedAtIso || "", 80);
  if (iso) {
    const parsed = new Date(iso).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const timestamp = item?.createdAt || item?.updatedAt;
  if (timestamp && typeof timestamp.toDate === "function") {
    const parsed = timestamp.toDate().getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

async function loadLatestScopedRiskSource({ companyId, locationId }) {
  const variants = [
    { companyField: "companyId", companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId", companyValue: toLegacyId(companyId), locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: toLegacyId(companyId), locationValue: toLegacyId(locationId) }
  ];

  for (const variant of variants) {
    const normalizedCompanyValue = sanitizeString(variant.companyValue, 120);
    const normalizedLocationValue = sanitizeString(variant.locationValue, 120);
    if (!normalizedCompanyValue || !normalizedLocationValue) continue;

    for (const collectionName of ["live_user_profiles", "haccp_snapshots"]) {
      try {
        const snapshot = await db
          .collection(collectionName)
          .where(variant.companyField, "==", normalizedCompanyValue)
          .where("locationId", "==", normalizedLocationValue)
          .limit(20)
          .get();

        if (!snapshot.empty) {
          const docs = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => getComparableEpoch(b) - getComparableEpoch(a));

          const latest = docs[0] || null;
          if (latest) {
            return {
              sourceCollection: collectionName,
              payload: latest
            };
          }
        }
      } catch (error) {
        console.warn(`Kunne ikke hente ${collectionName} for ${variant.companyField}:`, error);
      }
    }
  }

  return null;
}

exports.syncRiskTaskTemplates = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind for at synkronisere task-skabeloner.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const userData = await getUserAccessProfile({ uid, email });

  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const requestedCompanyId = sanitizeString(data?.companyId, 120);
  const requestedLocationId = sanitizeString(data?.locationId, 120);

  const companyId = requestedCompanyId || sanitizeString(userData.companyId || userData.organizationId, 120);
  const locationIds = getUserLocationIds(userData);
  const locationId = requestedLocationId || locationIds[0] || sanitizeString(userData.primaryLocationId || userData.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "companyId eller locationId mangler.");
  }

  await assertLexiCustomerAccess({ uid, email, companyId, locationId });

  const riskSource = await loadLatestScopedRiskSource({ companyId, locationId });
  if (!riskSource?.payload) {
    throw new functions.https.HttpsError("not-found", "Ingen live risikoanalyse fundet for denne lokation.");
  }

  const payload = riskSource.payload || {};
  const profile = sanitizeOnboardingProfile(payload.profile || {
    companyName: payload.companyName,
    companyType: payload.companyType,
    cvr: payload.cvr,
    address: payload.address
  });
  const riskModel = sanitizeRiskModelInput(payload.riskModel || payload.generated || {});

  // Generate scenario-based HACCP analysis
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: profile,
    companyType: profile.companyType
  });

  // Save comprehensive HACCP snapshot to haccp_snapshots collection
  const snapshotId = toDocSafeId(`${companyId}__${locationId}__${Date.now()}`);
  await db.collection("haccp_snapshots").doc(snapshotId).set({
    companyId,
    organizationId: companyId,
    locationId,
    profile,
    riskModel,
    // Scenario-based data structures
    scenarios: scenarioHaccp.scenarios || [],
    processes: scenarioHaccp.processes || [],
    hazards: scenarioHaccp.hazards || [],
    controlMeasures: scenarioHaccp.controlMeasures || [],
    criticalLimits: scenarioHaccp.criticalLimits || [],
    monitoringProcedures: scenarioHaccp.monitoringProcedures || [],
    correctiveActions: scenarioHaccp.correctiveActions || [],
    verificationTasks: scenarioHaccp.verificationTasks || [],
    documentationRequirements: scenarioHaccp.documentationRequirements || [],
    taskTemplates: scenarioHaccp.taskTemplates || [],
    // Backward compatible KCPs
    kcps: scenarioHaccp.kcps || [],
    // Metadata
    version: scenarioHaccp.version || "3.0_scenario_based",
    summary: scenarioHaccp.summary || {},
    generatedAt: scenarioHaccp.generatedAt || new Date().toISOString(),
    generatedBy: uid,
    generatedByEmail: email,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const summary = await ensureLiveTaskTemplatesForProvisioning({
    companyId,
    locationId,
    profile,
    riskModel,
    userId: uid,
    userEmail: email
  });

  return {
    ok: true,
    companyId,
    locationId,
    sourceCollection: riskSource.sourceCollection,
    snapshotId,
    taskTemplateCount: Number(summary?.created || 0),
    scenarioCount: scenarioHaccp.scenarios?.length || 0,
    processCount: scenarioHaccp.processes?.length || 0,
    hazardCount: scenarioHaccp.hazards?.length || 0,
    controlMeasureCount: scenarioHaccp.controlMeasures?.length || 0,
    ccpCount: scenarioHaccp.summary?.totalCCPs || 0,
    cpCount: scenarioHaccp.summary?.totalCPs || 0
  };
});

// ─── ADMIN: RE-PROVISION EQUIPMENT FOR EXISTING LOCATION ────────────────────
// Kald dette for lokationer som ikke gik igennem det nye checkout-flow.
// Populerer `equipment` collection, rydder op i cleaning/maintenance templates.
exports.adminReprovisionEquipment = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  // Accept explicit counts or fall back to live_user_profiles → profile
  let equipmentCounts = {};
  let profile = {};

  if (data?.equipmentCounts && typeof data.equipmentCounts === "object") {
    equipmentCounts = data.equipmentCounts;
  } else {
    // Try to load from live_user_profiles
    const liveSnap = await db.collection("live_user_profiles")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    if (!liveSnap.empty) {
      const liveData = liveSnap.docs[0].data() || {};
      profile = liveData.profile || {};
      equipmentCounts = liveData.onboardingAnswers?.equipmentCounts || {};
    }
  }

  const eqResult = await syncOnboardingEquipmentUnits({ db, companyId, locationId, equipmentCounts, profile });
  const cleanResult = await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  const maintResult = await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  const areaResult  = await syncAreaCleaningTemplates({ db, companyId, locationId });
  const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
  //const waterResult = await syncWaterControlTemplates({ db, companyId, locationId });

  // Steg 4: Generer/opdater risks fra onboarding
  const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
  const risksResult = await generateRisksFromOnboardingAnswers({ locationId });

  // Steg 5: Byg task_templates fra risks
  const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
  const templatesResult = await generateEgenkontrolFromRiskAnalysis({ locationId, db });

  return {
    ok: true,
    companyId,
    locationId,
    equipment: eqResult,
    cleaningTemplates: cleanResult,
    maintenanceTemplates: maintResult,
    areaTemplates: areaResult,
    driftTemplates: driftResult,
   // waterControlTemplates: waterResult,
    risks: risksResult,
    riskTemplates: templatesResult
  };
});

// ─── ADMIN: GENERER RISKS FRA ONBOARDING ─────────────────────────────────────
exports.generateRisksForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
  const result = await generateRisksFromOnboardingAnswers({ locationId });

  return { ok: true, ...result };
});

// ─── ADMIN: GENERER EGENKONTROL-TEMPLATES FRA RISKS ──────────────────────────
exports.generateTemplatesForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
  const result = await generateEgenkontrolFromRiskAnalysis({ locationId, db });

  return { ok: true, ...result };
});

async function getLexiCustomerStatusPayload({ companyId, locationId }) {
  const todayKey = getDateKey();
  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  // Ensure location has temperature control settings for new schedule system
  let locationTemperatureSettings = null;
  try {
    locationTemperatureSettings = await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (err) {
    console.warn("[getLexiCustomerStatusPayload] ensureLocationTemperatureSettings failed:", err.message);
  }

  // Load equipment units with temperatureControl settings
  const equipmentUnitMap = new Map();
  try {
    const equipmentSnap = await db.collection("equipment")
      .where("locationId", "==", locationId)
      .get();
    
    for (const equipmentDoc of equipmentSnap.docs) {
      const equipment = equipmentDoc.data() || {};
      if (equipment.active === false) continue;
      const normalized = {
        id: equipmentDoc.id,
        type: sanitizeEquipmentType(equipment.type || equipment.equipmentType),
        temperatureControl: equipment.temperatureControl || null
      };
      
      try {
        const normalizedUnit = await ensureEquipmentTemperatureControl(db, locationId, normalized);
        if (normalizedUnit.temperatureControl) {
          normalized.temperatureControl = normalizedUnit.temperatureControl;
        }
      } catch (err) {
        console.warn(`[getLexiCustomerStatusPayload] ensureEquipmentTemperatureControl failed for ${normalized.id}:`, err.message);
      }
      
      equipmentUnitMap.set(normalized.id, normalized);
    }
  } catch (err) {
    console.warn("[getLexiCustomerStatusPayload] Failed to load equipment:", err.message);
  }

  const [templateDocs] = await Promise.all([
    loadActiveTaskTemplates({ companyId, locationId })
  ]);

  const routineChecks = await Promise.all(templateDocs.map(async (doc) => {
    const template = doc.data() || {};
    const taskId = sanitizeString(template.taskId, 120);

    try {
      // Resolve schedule configuration combining template, location and unit settings
      const equipmentUnitId = template.equipmentUnit || template.equipmentId || "";
      const unitForTemplate = equipmentUnitId ? equipmentUnitMap.get(equipmentUnitId) : null;
      
      const resolvedSchedule = resolveTemplateSchedule({
        template,
        locationTemperatureSettings,
        unitTemperatureControl: unitForTemplate?.temperatureControl || null,
        todayKey
      });

      // Check if unit is disabled - skip if so
      if (resolvedSchedule && resolvedSchedule.enabled === false) {
        return { dueToday: false };
      }

      const lastCompletedDateKey = taskId
        ? await getLastCompleted(taskId, locationId)
        : null;
      
      // Use new schedule system if available, otherwise fallback to legacy
      let dueToday = false;
      if (resolvedSchedule && resolvedSchedule.useNewSchedule) {
        const anchorDate = resolvedSchedule.anchorDate || locationTemperatureSettings?.anchorDate || todayKey;
        dueToday = shouldRunToday(resolvedSchedule, todayKey, anchorDate, lastCompletedDateKey);
      } else {
        dueToday = isDueToday(template, todayKey, lastCompletedDateKey);
      }
      
      // Debug logging for schedule consistency validation
      console.log("[SCHEDULE_DEBUG]", {
        templateId: doc.id,
        taskId: taskId,
        hasScheduleConfig: !!template.scheduleConfig,
        resolvedSchedule: resolvedSchedule ? {
          useNewSchedule: resolvedSchedule.useNewSchedule,
          enabled: resolvedSchedule.enabled,
          scheduleType: resolvedSchedule.scheduleType,
          recurrenceMode: resolvedSchedule.recurrenceMode,
          recurrenceValue: resolvedSchedule.recurrenceValue
        } : null,
        lastCompletedDateKey: lastCompletedDateKey,
        dueToday: dueToday,
        source: "lexi"
      });
      
      return { dueToday };
    } catch (error) {
      console.error(`Kunne ikke beregne rutine for template ${doc.id}:`, error);
      return { dueToday: true };
    }
  }));

  const totalActive = routineChecks.length;
  const dueToday = routineChecks.filter((routine) => routine.dueToday).length;
  const status = resolveLexiStatus({ operatingMode, totalActive, dueToday });

  return {
    source: "madkontrol",
    companyId,
    locationId,
    dateKey: todayKey,
    operatingMode,
    status,
    antal_rutiner: totalActive,
    antal_forfaldne_rutiner: dueToday
  };
}