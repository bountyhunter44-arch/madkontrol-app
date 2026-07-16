const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    try {
        console.log("Genererer company setup...");

        const areasSnapshot = await db.collection("areas").get();
        const requirementTemplatesSnapshot = await db.collection("requirement_templates").get();
        const riskTemplatesSnapshot = await db.collection("risk_templates").get();
        const controlPointTemplatesSnapshot = await db.collection("control_point_templates").get();

        const areas = areasSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const requirementTemplates = requirementTemplatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const riskTemplates = riskTemplatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const controlPointTemplates = controlPointTemplatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        let requirementCount = 0;
        let riskCount = 0;
        let controlPointCount = 0;

        for (const area of areas) {
            const matchingRequirements = requirementTemplates.filter(
                template => template.areaType === area.areaType && template.isActive !== false
            );

            const matchingRisks = riskTemplates.filter(
                template => template.areaType === area.areaType && template.isActive !== false
            );

            const matchingControlPoints = controlPointTemplates.filter(
                template => template.areaType === area.areaType && template.isActive !== false
            );

            for (const template of matchingRequirements) {
                const docId = `${area.id}__${template.code}`;

                await db.collection("company_requirements").doc(docId).set(
                    {
                        companyId: area.companyId,
                        unitId: area.unitId,
                        locationId: area.locationId,
                        areaId: area.id,
                        areaName: area.name,
                        areaType: area.areaType,

                        templateId: template.id,
                        templateCode: template.code,
                        title: template.title,
                        category: template.category || "",
                        severity: template.severity || "medium",
                        requirementType: template.requirementType || "",
                        description: template.description || "",
                        explanation: template.explanation || "",
                        whyItMatters: template.whyItMatters || "",
                        authorityLabel: template.authorityLabel || "",
                        authorityUrl: template.authorityUrl || "",
                        canUseAlternativeJustification: template.canUseAlternativeJustification || false,

                        complianceStatus: "pending",
                        isActive: true,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );

                console.log(`Requirement oprettet: ${docId}`);
                requirementCount++;
            }

            for (const template of matchingRisks) {
                const docId = `${area.id}__${template.code}`;

                await db.collection("risk_analysis_items").doc(docId).set(
                    {
                        companyId: area.companyId,
                        unitId: area.unitId,
                        locationId: area.locationId,
                        areaId: area.id,
                        areaName: area.name,
                        areaType: area.areaType,

                        templateId: template.id,
                        templateCode: template.code,
                        title: template.title,
                        activityType: template.activityType || "",
                        hazardType: template.hazardType || "",
                        severity: template.severity || "medium",
                        isCritical: template.isCritical || false,
                        description: template.description || "",
                        riskReason: template.riskReason || "",
                        exampleScenario: template.exampleScenario || "",
                        recommendedControl: template.recommendedControl || "",

                        status: "active",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );

                console.log(`Risk item oprettet: ${docId}`);
                riskCount++;
            }

            for (const template of matchingControlPoints) {
                const docId = `${area.id}__${template.code}`;

                await db.collection("control_points").doc(docId).set(
                    {
                        companyId: area.companyId,
                        unitId: area.unitId,
                        locationId: area.locationId,
                        areaId: area.id,
                        areaName: area.name,
                        areaType: area.areaType,

                        templateId: template.id,
                        templateCode: template.code,
                        title: template.title,
                        category: template.category || "",
                        controlType: template.controlType || "",
                        frequency: template.frequency || "daily",
                        limitType: template.limitType || "",
                        limitValue: template.limitValue || "",
                        limitUnit: template.limitUnit || "",
                        isCritical: template.isCritical || false,
                        requiresEvidence: template.requiresEvidence || false,
                        description: template.description || "",
                        instruction: template.instruction || "",
                        deviationPrompt: template.deviationPrompt || "",

                        status: "active",
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );

                console.log(`Control point oprettet: ${docId}`);
                controlPointCount++;
            }
        }

        console.log("Company setup færdig ✅");
        console.log(`Requirements oprettet: ${requirementCount}`);
        console.log(`Risk items oprettet: ${riskCount}`);
        console.log(`Control points oprettet: ${controlPointCount}`);
    } catch (error) {
        console.error("Fejl i generateCompanySetup:", error);
        process.exitCode = 1;
    }
}

run();