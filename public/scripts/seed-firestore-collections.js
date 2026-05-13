const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const now = FieldValue.serverTimestamp();

const accounts = [
    {
        id: "acc_michael",
        name: "Michael Nielsen",
        email: "michael@example.com",
        role: "owner",
        isActive: true,
        createdAt: now,
        lastLoginAt: now
    }
];

const organizations = [
    {
        id: "org_aarhus_burger_group",
        name: "Århus Burger ApS",
        cvr: "12345678",
        billingEmail: "faktura@aarhusburger.dk",
        phone: "70123456",
        ownerAccountId: "acc_michael",
        status: "active",
        planType: "multi-site",
        createdAt: now
    }
];

const locations = [
    {
        id: "loc_aarhus_burger_bruuns",
        organizationId: "org_aarhus_burger_group",
        name: "Århus Burger Bruuns",
        slug: "aarhus-burger-bruuns",
        city: "Aarhus",
        address: "M. P. Bruuns Gade 25",
        postalCode: "8000",
        country: "DK",
        phone: "70123456",
        email: "bruuns@aarhusburger.dk",
        type: "burger",
        offerings: ["burger", "takeaway", "catering"],
        status: "active",
        websiteStatus: "generated",
        subdomain: "aarhus-burger-bruuns",
        createdAt: now
    },
    {
        id: "loc_aarhus_burger_trio",
        organizationId: "org_aarhus_burger_group",
        name: "Århus Burger Trøjborg",
        slug: "aarhus-burger-trojborg",
        city: "Aarhus",
        address: "Tordenskjoldsgade 12",
        postalCode: "8200",
        country: "DK",
        phone: "70123457",
        email: "trojborg@aarhusburger.dk",
        type: "burger",
        offerings: ["burger", "takeaway", "frokost"],
        status: "active",
        websiteStatus: "generated",
        subdomain: "aarhus-burger-trojborg",
        createdAt: now
    }
];

const memberships = [
    {
        id: "mem_michael_org_aarhus_burger_group",
        accountId: "acc_michael",
        organizationId: "org_aarhus_burger_group",
        role: "owner",
        permissions: ["billing", "manage_locations", "manage_modules", "manage_websites"],
        createdAt: now
    }
];

const modules = [
    {
        id: "mod_core",
        key: "core",
        name: "Madkontrollen Kernen",
        type: "base",
        monthlyPrice: 99,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        isActive: true
    },
    {
        id: "mod_egenkontrol_plus",
        key: "egenkontrol_plus",
        name: "Udvidet Egenkontrol",
        type: "addon",
        monthlyPrice: 79,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        isActive: true
    },
    {
        id: "mod_kalkulation",
        key: "kalkulation",
        name: "Kalkulation",
        type: "addon",
        monthlyPrice: 69,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        isActive: true
    },
    {
        id: "mod_seo_website",
        key: "seo_website",
        name: "SEO & Hjemmeside",
        type: "addon",
        monthlyPrice: 89,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        isActive: true
    }
];

const subscriptions = [
    {
        id: "sub_core_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        moduleKey: "core",
        billingPeriod: "monthly",
        unitPrice: 99,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        finalPrice: 89,
        status: "active",
        startsAt: now,
        endsAt: null
    },
    {
        id: "sub_core_trojborg",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_trio",
        moduleKey: "core",
        billingPeriod: "monthly",
        unitPrice: 99,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        finalPrice: 89,
        status: "active",
        startsAt: now,
        endsAt: null
    },
    {
        id: "sub_seo_bruuns_preview",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        moduleKey: "seo_website",
        billingPeriod: null,
        unitPrice: 89,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        finalPrice: null,
        status: "preview",
        startsAt: now,
        endsAt: null
    },
    {
        id: "sub_kalkulation_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        moduleKey: "kalkulation",
        billingPeriod: "monthly",
        unitPrice: 69,
        yearlyDiscountPct: 10,
        multiUnitDiscountPct: 10,
        finalPrice: 62,
        status: "active",
        startsAt: now,
        endsAt: null
    }
];

const tasks = [
    {
        id: "task_fridge_temp_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        title: "Køl temperatur morgen",
        category: "temperature",
        frequency: "daily",
        isRequired: true,
        createdAt: now
    },
    {
        id: "task_cleaning_close_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        title: "Rengøring ved luk",
        category: "cleaning",
        frequency: "daily",
        isRequired: true,
        createdAt: now
    },
    {
        id: "task_fridge_temp_trojborg",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_trio",
        title: "Køl temperatur morgen",
        category: "temperature",
        frequency: "daily",
        isRequired: true,
        createdAt: now
    }
];

const taskEntries = [
    {
        id: "entry_fridge_temp_bruuns_today",
        taskId: "task_fridge_temp_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        dateKey: "2026-03-13",
        value: "3.2",
        status: "completed",
        comment: "OK",
        createdBy: "acc_michael",
        createdAt: now
    },
    {
        id: "entry_cleaning_close_bruuns_today",
        taskId: "task_cleaning_close_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        dateKey: "2026-03-13",
        value: "Udført",
        status: "completed",
        comment: "Alt rengjort",
        createdBy: "acc_michael",
        createdAt: now
    }
];

const alerts = [
    {
        id: "alert_fridge_temp_high_trojborg",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_trio",
        taskId: "task_fridge_temp_trojborg",
        entryId: null,
        severity: "warning",
        message: "Køleskabstemperatur kræver kontrol",
        resolved: false,
        createdAt: now
    }
];

const websites = [
    {
        id: "web_bruuns",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        subdomain: "aarhus-burger-bruuns",
        template: "classic",
        brandMode: "madkontrollen_default",
        logoUrl: null,
        heroTitle: "Århus Burger Bruuns",
        heroText: "Saftige burgere i Aarhus C",
        status: "published",
        seoPreviewEnabled: true,
        customDomain: null,
        updatedAt: now
    },
    {
        id: "web_trojborg",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_trio",
        subdomain: "aarhus-burger-trojborg",
        template: "classic",
        brandMode: "madkontrollen_default",
        logoUrl: null,
        heroTitle: "Århus Burger Trøjborg",
        heroText: "Takeaway og burger på Trøjborg",
        status: "draft",
        seoPreviewEnabled: true,
        customDomain: null,
        updatedAt: now
    }
];

const seoPages = [
    {
        id: "seo_bruuns_best_burger_aarhus",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        websiteId: "web_bruuns",
        slug: "bedste-burger-i-aarhus",
        keyword: "bedste burger i Aarhus",
        title: "Århus Burger Bruuns | Bedste burger i Aarhus",
        status: "preview",
        generatedAt: now
    },
    {
        id: "seo_bruuns_takeaway_aarhus",
        organizationId: "org_aarhus_burger_group",
        locationId: "loc_aarhus_burger_bruuns",
        websiteId: "web_bruuns",
        slug: "takeaway-aarhus",
        keyword: "takeaway Aarhus",
        title: "Århus Burger Bruuns | Takeaway Aarhus",
        status: "preview",
        generatedAt: now
    }
];

const collectionMap = {
    accounts,
    organizations,
    locations,
    memberships,
    modules,
    subscriptions,
    tasks,
    task_entries: taskEntries,
    alerts,
    websites,
    seo_pages: seoPages
};

async function seedCollection(collectionName, docs) {
    const batch = db.batch();

    docs.forEach((doc) => {
        const ref = db.collection(collectionName).doc(doc.id);
        const data = { ...doc };
        delete data.id;
        batch.set(ref, data, { merge: true });
    });

    await batch.commit();
    console.log(`Seedet ${docs.length} dokument(er) i ${collectionName}`);
}

async function run() {
    try {
        console.log("Starter seed af Firestore collections...");

        for (const [collectionName, docs] of Object.entries(collectionMap)) {
            await seedCollection(collectionName, docs);
        }

        console.log("Seed færdig ✅");
    } catch (error) {
        console.error("Seed fejlede ❌", error);
        process.exit(1);
    }
}

run();