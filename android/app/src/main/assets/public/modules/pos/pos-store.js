import { auth, db } from "/core/firebase-config.js";
import { getBusinessSnapshotFromContext, resolvePlatformContext } from "/platform/context-provider.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const LOCAL_KEYS = [
  "pos_products",
  "pos_sales",
  "pos_reconciliations",
  "pos_receipt_sequence",
  "pos_cash_sessions",
  "pos_audit_log",
  "pos_payment_reconciliations",
  "pos_payment_sessions"
];

const POS_SALE_STATUSES = new Set([
  "draft",
  "pending_payment",
  "paid",
  "failed",
  "cancelled",
  "refunded"
]);

const DEFAULT_PRODUCTS = [
  { id: "default_1", name: "Dagens ret", price: 89, category: "Mad" },
  { id: "default_2", name: "Burger menu", price: 119, category: "Mad" },
  { id: "default_3", name: "Frokostplatte", price: 99, category: "Mad" },
  { id: "default_4", name: "Kaffe", price: 25, category: "Drikke" }
];

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readLocalJson(key, fallback) {
  try {
    return safeJson(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function cleanId(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120) || fallback;
}

function dateKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function moneyNumber(value) {
  return Number(value || 0);
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    const decoded = new TextDecoder("utf-8").decode(Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 255)));
    return decoded.includes("�") ? text : decoded.trim();
  } catch {
    return text
      .replace(/Ã˜/g, "Ø")
      .replace(/Ã¸/g, "ø")
      .replace(/Ã…/g, "Å")
      .replace(/Ã¥/g, "å")
      .replace(/Ã†/g, "Æ")
      .replace(/Ã¦/g, "æ")
      .replace(/Ã©/g, "é");
  }
}

function normalizeCvr(value) {
  return cleanText(value).replace(/\bCVR\b/gi, "").replace(/\bDK\b/gi, "").replace(/\D/g, "").slice(0, 8);
}

function splitAddressParts(source = {}) {
  let address = cleanText(source.address || "");
  let postalCode = cleanText(source.postalCode || source.zip || "");
  let city = cleanText(source.city || "");
  const commaMatch = address.match(/^(.+?),\s*(\d{4})\s+(.+)$/);
  if (commaMatch) {
    address = commaMatch[1].trim();
    postalCode = postalCode || commaMatch[2].trim();
    city = city || cleanText(commaMatch[3]);
  }
  const duplicateSuffix = [postalCode, city].filter(Boolean).join(" ");
  if (duplicateSuffix && address.endsWith(`, ${duplicateSuffix}`)) {
    address = address.slice(0, -(`, ${duplicateSuffix}`).length).trim();
  }
  return { address, postalCode, city };
}

function formatReceiptNumber(receiptNumber) {
  return `BON-${String(receiptNumber).padStart(6, "0")}`;
}

function normalizeProduct(raw = {}) {
  const id = String(raw.id || raw.productId || raw.docId || `product_${Date.now()}`);
  const category = cleanText(raw.category || "Andet") || "Andet";
  const priceIncVat = moneyNumber(raw.priceIncVat ?? raw.price);
  const image = normalizeProductImage(raw);
  return {
    id,
    productId: id,
    name: cleanText(raw.name || ""),
    price: priceIncVat,
    priceIncVat,
    vatRate: Number(raw.vatRate ?? 0.25) || 0.25,
    active: raw.active !== false && raw.status !== "inactive" && raw.status !== "deleted",
    category,
    image,
    imageUrl: image.secureUrl || image.thumbnailUrl || cleanText(raw.imageUrl || ""),
    imageStoragePath: cleanText(raw.imageStoragePath || ""),
    imageAlt: image.alt || cleanText(raw.imageAlt || raw.name || ""),
    status: raw.status || "active"
  };
}

function normalizeProductImage(product = {}) {
  const rawImage = product && typeof product.image === "object" && product.image !== null
    ? product.image
    : {};
  const fallbackUrl = cleanText(
    rawImage.thumbnailUrl ||
    rawImage.secureUrl ||
    rawImage.thumbUrl ||
    rawImage.url ||
    product.imageUrl ||
    ""
  );

  if (!fallbackUrl) {
    return {
      provider: "",
      cloudinaryPublicId: "",
      secureUrl: "",
      thumbnailUrl: "",
      width: null,
      height: null,
      format: "",
      alt: cleanText(product.name || product.imageAlt || "Produktbillede") || "Produktbillede",
      source: "placeholder",
      prompt: "",
      generatedAt: null,
      updatedAt: null
    };
  }

  return {
    provider: cleanText(rawImage.provider || (product.imageUrl ? "external_fallback" : "cloudinary")),
    cloudinaryPublicId: cleanText(rawImage.cloudinaryPublicId || rawImage.publicId || product.cloudinaryPublicId || ""),
    secureUrl: cleanText(rawImage.secureUrl || rawImage.url || fallbackUrl),
    thumbnailUrl: cleanText(rawImage.thumbnailUrl || rawImage.thumbUrl || fallbackUrl),
    width: Number(rawImage.width || 0) || null,
    height: Number(rawImage.height || 0) || null,
    format: cleanText(rawImage.format || ""),
    alt: cleanText(rawImage.alt || product.imageAlt || product.name || "Produktbillede") || "Produktbillede",
    source: cleanText(rawImage.source || (product.imageUrl ? "legacy_url" : "unknown")) || "unknown",
    prompt: cleanText(rawImage.prompt || "", 1800),
    generatedAt: rawImage.generatedAt || null,
    updatedAt: rawImage.updatedAt || null
  };
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedDeep(item)])
  );
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function sanitizeProductForFirestore(product = {}) {
  const normalized = normalizeProduct(product);
  return stripUndefinedDeep({
    id: normalized.id,
    productId: normalized.productId,
    name: normalized.name,
    category: normalized.category,
    price: normalized.priceIncVat,
    priceIncVat: normalized.priceIncVat,
    vatRate: normalized.vatRate,
    active: normalized.active,
    image: normalized.image,
    imageUrl: normalized.imageUrl,
    imageStoragePath: normalized.imageStoragePath,
    imageAlt: normalized.imageAlt,
    status: normalized.status
  });
}

function mergeProductPatch(existing = {}, patch = {}, productId = "") {
  const cleanPatch = stripUndefinedDeep(patch);
  const merged = {
    ...existing,
    ...cleanPatch,
    id: existing.id || productId,
    productId: existing.productId || productId
  };

  if (!hasOwn(cleanPatch, "image")) {
    merged.image = existing.image;
  }
  if (!hasOwn(cleanPatch, "imageUrl")) {
    merged.imageUrl = existing.imageUrl || "";
  }
  if (!hasOwn(cleanPatch, "imageAlt")) {
    merged.imageAlt = existing.imageAlt || existing.name || cleanPatch.name || "";
  }

  return sanitizeProductForFirestore(merged);
}

function normalizePayment(payment = {}, fallbackMethod = "cash") {
  const method = payment.method || fallbackMethod || "cash";
  return {
    method,
    provider: payment.provider || "manual",
    providerMode: payment.providerMode || "manual",
    externalTransactionId: payment.externalTransactionId || "",
    providerPaymentId: payment.providerPaymentId || "",
    paymentSessionId: payment.paymentSessionId || "",
    settlementAccountType: payment.settlementAccountType || (method === "cash" ? "cash_drawer" : "other"),
    settlementAccountLabel: payment.settlementAccountLabel || "",
    reconciliationStatus: payment.reconciliationStatus || "pending",
    settledAt: payment.settledAt || "",
    note: payment.note || "",
    cardDataHandledByProvider: payment.cardDataHandledByProvider === true
  };
}

function normalizeSaleStatus(value, fallback = "paid") {
  const status = String(value || fallback || "paid").trim().toLowerCase();
  return POS_SALE_STATUSES.has(status) ? status : fallback;
}

function normalizeBusinessSnapshot(input = {}, fallback = {}) {
  const source = { ...fallback, ...input };
  const addressParts = splitAddressParts(source);
  return {
    uid: source.uid || "",
    companyId: source.companyId || "",
    locationId: source.locationId || "",
    name: cleanText(source.name || source.companyName || source.businessName || ""),
    companyName: cleanText(source.companyName || source.name || source.businessName || ""),
    cvr: normalizeCvr(source.cvr || source.cvrNumber || source.vatNumber || source.taxId || ""),
    address: addressParts.address,
    postalCode: addressParts.postalCode,
    city: addressParts.city,
    country: cleanText(source.country || "DK"),
    phone: cleanText(source.phone || ""),
    email: cleanText(source.email || source.accountEmail || ""),
    industryCode: cleanText(source.industryCode || ""),
    industryText: cleanText(source.industryText || source.industry || ""),
    activeModules: Array.isArray(source.activeModules) ? source.activeModules : [],
    source: source.source || "missing"
  };
}

function scopeData(context = {}) {
  return {
    companyId: context.companyId || "",
    locationId: context.locationId || ""
  };
}

function hasScope(context = {}) {
  return Boolean(context.companyId && context.locationId);
}

function posDocPath(context, collectionName, docId) {
  return doc(db, "companies", context.companyId, "locations", context.locationId, collectionName, docId);
}

function posCollectionPath(context, collectionName) {
  return collection(db, "companies", context.companyId, "locations", context.locationId, collectionName);
}

async function addAudit(context, action, payload = {}) {
  if (!hasScope(context)) return null;
  const ref = doc(posCollectionPath(context, "pos_audit_log"));
  await setDoc(ref, {
    ...scopeData(context),
    action,
    payload,
    source: "pos_v1",
    createdAt: serverTimestamp(),
    createdAtIso: new Date().toISOString()
  });
  return ref.id;
}

async function listCollection(context, collectionName) {
  if (!hasScope(context)) return [];
  const snap = await getDocs(posCollectionPath(context, collectionName));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function localProducts() {
  const stored = readLocalJson("pos_products", null);
  return Array.isArray(stored) ? stored.map(normalizeProduct) : [];
}

function localSales() {
  const stored = readLocalJson("pos_sales", []);
  return Array.isArray(stored) ? stored : [];
}

function localBusinessProfile() {
  const profile = readLocalJson("pos_business_profile", {});
  return profile && typeof profile === "object" ? profile : {};
}

function waitForPosAuth(timeoutMs = 10000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("POS kræver login før data kan hentes."));
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(user);
    }, (error) => {
      clearTimeout(timer);
      unsubscribe();
      reject(error);
    });
  });
}

export async function createPosStore(options = {}) {
  const user = options.user || await waitForPosAuth(options.authTimeoutMs || 10000);
  if (typeof window !== "undefined") {
    window.currentUser = user;
  }
  const context = await resolvePlatformContext({ sourceApp: options.sourceApp || "pos" }).catch((error) => {
    console.warn("[pos-store] context fallback", error);
    return { source: "missing" };
  });
  const businessSnapshot = normalizeBusinessSnapshot(getBusinessSnapshotFromContext(context), {
    ...localBusinessProfile(),
    ...context
  });
  const cloudEnabled = hasScope(context);

  async function listProducts() {
    if (!cloudEnabled) return [];
    const rows = await listCollection(context, "pos_products");
    return rows
      .map((row) => normalizeProduct({ ...row, id: row.productId || row.id }))
      .filter((product) => product.status !== "deleted")
      .sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
  }

  async function createProduct(input = {}) {
    const product = normalizeProduct({
      ...input,
      id: input.id || `product_${Date.now()}`
    });
    if (!product.name || Number.isNaN(product.price) || product.price < 0) {
      throw new Error("Angiv et gyldigt produktnavn og en gyldig pris.");
    }
    if (!cloudEnabled) {
      throw new Error("POS er ikke koblet til en virksomhed endnu.");
    }
    await setDoc(posDocPath(context, "pos_products", cleanId(product.id)), {
      ...scopeData(context),
      ...product,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
    await addAudit(context, "pos_product_created", { productId: product.id, name: product.name, price: product.price });
    return product;
  }

  async function updateProduct(productId, patch = {}) {
    if (!productId) throw new Error("Produkt mangler id.");
    if (!cloudEnabled) {
      throw new Error("POS er ikke koblet til en virksomhed endnu.");
    }
    const productRef = posDocPath(context, "pos_products", cleanId(productId));
    const existingSnap = await getDoc(productRef);
    const existing = existingSnap.exists()
      ? normalizeProduct({ id: productId, ...existingSnap.data(), productId })
      : normalizeProduct({ id: productId, productId });
    const next = mergeProductPatch(existing, patch, productId);
    await setDoc(productRef, {
      ...scopeData(context),
      ...next,
      updatedAt: serverTimestamp(),
      updatedBy: context.uid || ""
    }, { merge: true });
    await addAudit(context, "pos_product_updated", { productId, patch });
    return next;
  }

  async function deleteProduct(productId) {
    if (!productId) return;
    if (!cloudEnabled) {
      throw new Error("POS er ikke koblet til en virksomhed endnu.");
    }
    await updateDoc(posDocPath(context, "pos_products", cleanId(productId)), {
      status: "deleted",
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await addAudit(context, "pos_product_deleted", { productId });
  }

  async function listSales() {
    if (!cloudEnabled) return [];
    const rows = await listCollection(context, "pos_sales");
    return rows.sort((a, b) => String(b.createdAtIso || b.createdAt || "").localeCompare(String(a.createdAtIso || a.createdAt || "")));
  }

  async function createSale(input = {}) {
    if (!cloudEnabled) {
      throw new Error("Virksomhedsoplysninger mangler. Salg kan ikke bogføres uden companyId/locationId.");
    }
    const nowIso = new Date().toISOString();
    const sequenceRef = posDocPath(context, "pos_receipt_sequences", "main");
    const saleRef = doc(posCollectionPath(context, "pos_sales"));
    const auditRef = doc(posCollectionPath(context, "pos_audit_log"));
    const payment = normalizePayment(input.payment, input.paymentMethod);
    const status = normalizeSaleStatus(input.status, input.type === "credit_note" ? "paid" : "paid");
    const paymentProvider = input.paymentProvider || payment.provider || "manual";
    const paymentStatus = input.paymentStatus || (
      status === "paid" ? "paid" :
        status === "pending_payment" ? "pending" :
          status
    );
    const reconciliationRef = payment.method !== "cash"
      ? posDocPath(context, "pos_payment_reconciliations", saleRef.id)
      : null;
    const sale = await runTransaction(db, async (transaction) => {
      const sequenceSnap = await transaction.get(sequenceRef);
      const current = sequenceSnap.exists() ? Number(sequenceSnap.data().lastNumber || 0) : 0;
      const receiptNumber = current + 1;
      const receiptLabel = formatReceiptNumber(receiptNumber);
      const payload = {
        ...scopeData(context),
        ...input,
        id: saleRef.id,
        type: input.type || "sale",
        status,
        receiptNumber,
        receiptLabel,
        payment,
        paymentMethod: payment.method,
        paymentProvider,
        paymentStatus,
        externalPaymentId: input.externalPaymentId || payment.providerPaymentId || "",
        paymentSessionId: input.paymentSessionId || payment.paymentSessionId || "",
        currency: input.currency || "DKK",
        total: Number(input.total ?? input.totalInclVat ?? input.vatSummary?.totalIncVat ?? 0) || 0,
        vatTotal: Number(input.vatTotal ?? input.vatAmount ?? input.vatSummary?.vatAmount ?? 0) || 0,
        createdBy: input.createdBy || context.uid || "",
        cashRegisterDayId: input.cashRegisterDayId || dateKey(),
        businessSnapshot: normalizeBusinessSnapshot(input.businessSnapshot || input.business, businessSnapshot),
        business: normalizeBusinessSnapshot(input.business || input.businessSnapshot, businessSnapshot),
        affectsCashDrawer: status === "paid" && payment.method === "cash",
        inventoryPosted: input.inventoryPosted === true,
        dailySalesPosted: input.dailySalesPosted === true,
        accountingPosted: input.accountingPosted === true,
        createdAt: serverTimestamp(),
        createdAtIso: nowIso,
        updatedAt: serverTimestamp()
      };
      transaction.set(sequenceRef, {
        ...scopeData(context),
        lastNumber: receiptNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });
      transaction.set(saleRef, payload);
      transaction.set(auditRef, {
        ...scopeData(context),
        action: input.type === "credit_note" ? "credit_note_created" : "sale_created",
        source: "pos_v1",
        payload: {
          saleId: saleRef.id,
          receiptNumber,
          receiptLabel,
          totalInclVat: input.totalInclVat,
          payment,
          correctionOf: input.correctionOf || ""
        },
        createdAt: serverTimestamp(),
        createdAtIso: nowIso
      });
      if (reconciliationRef) {
        transaction.set(reconciliationRef, {
          ...scopeData(context),
          saleId: saleRef.id,
          receiptNumber,
          receiptLabel,
          totalInclVat: input.totalInclVat,
          payment,
          status: payment.reconciliationStatus || "pending",
          createdAt: serverTimestamp(),
          createdAtIso: nowIso,
          updatedAt: serverTimestamp()
        });
      }
      return payload;
    });
    return sale;
  }

  async function updateSalePayment(saleId, patch = {}) {
    if (!cloudEnabled) throw new Error("Virksomhedsoplysninger mangler.");
    const saleRef = posDocPath(context, "pos_sales", saleId);
    const snap = await getDoc(saleRef);
    if (!snap.exists()) throw new Error("Salget blev ikke fundet.");
    const sale = { id: snap.id, ...snap.data() };
    const payment = { ...normalizePayment(sale.payment, sale.paymentMethod), ...patch };
    await updateDoc(saleRef, {
      payment,
      paymentMethod: payment.method,
      updatedAt: serverTimestamp()
    });
    if (payment.method !== "cash") {
      await setDoc(posDocPath(context, "pos_payment_reconciliations", saleId), {
        ...scopeData(context),
        saleId,
        receiptNumber: sale.receiptNumber || "",
        receiptLabel: sale.receiptLabel || "",
        totalInclVat: sale.totalInclVat || 0,
        payment,
        status: payment.reconciliationStatus || "pending",
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    await addAudit(context, "payment_reconciliation_updated", { saleId, payment });
  }

  async function createPaymentSession(input = {}) {
    if (!cloudEnabled) {
      throw new Error("Virksomhedsoplysninger mangler. Betalingssession kan ikke oprettes uden companyId/locationId.");
    }
    const nowIso = new Date().toISOString();
    const sessionRef = doc(posCollectionPath(context, "pos_payment_sessions"));
    const payload = {
      ...scopeData(context),
      id: sessionRef.id,
      status: input.status || "pending",
      amount: Number(input.amount || 0),
      currency: input.currency || "DKK",
      paymentMethod: input.paymentMethod || "zettle_reader",
      provider: input.provider || "zettle",
      providerMode: input.providerMode || "manual_reference",
      readerId: input.readerId || "",
      readerLinkId: input.readerLinkId || "",
      externalTransactionId: input.externalTransactionId || "",
      providerPaymentId: input.providerPaymentId || "",
      failureReason: input.failureReason || "",
      createdBy: context.uid || "",
      createdAt: serverTimestamp(),
      createdAtIso: nowIso,
      approvedAt: null,
      approvedAtIso: "",
      cancelledAt: null,
      cancelledAtIso: "",
      expiresAtIso: input.expiresAtIso || "",
      saleDraft: input.saleDraft || {}
    };
    await setDoc(sessionRef, payload);
    await addAudit(context, "payment_session_created", {
      paymentSessionId: sessionRef.id,
      provider: payload.provider,
      providerMode: payload.providerMode,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod
    });
    return payload;
  }

  async function updatePaymentSession(paymentSessionId, patch = {}) {
    if (!cloudEnabled) throw new Error("Virksomhedsoplysninger mangler.");
    if (!paymentSessionId) throw new Error("Betalingssession mangler id.");
    const sessionRef = posDocPath(context, "pos_payment_sessions", paymentSessionId);
    const next = {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString()
    };
    if (patch.status === "approved") next.approvedAt = serverTimestamp();
    if (patch.status === "cancelled") next.cancelledAt = serverTimestamp();
    await setDoc(sessionRef, next, { merge: true });
    await addAudit(context, "payment_session_updated", {
      paymentSessionId,
      status: patch.status || "",
      providerPaymentId: patch.providerPaymentId || "",
      externalTransactionId: patch.externalTransactionId || ""
    });
    const snap = await getDoc(sessionRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : { id: paymentSessionId, ...next };
  }

  async function getZettleSettings() {
    if (!cloudEnabled) return null;
    const snap = await getDoc(posDocPath(context, "pos_settings", "zettle"));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async function getPosSettings() {
    if (!cloudEnabled) return null;
    const snap = await getDoc(posDocPath(context, "pos_settings", "main"));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async function savePosSettings(settings = {}) {
    if (!cloudEnabled) {
      throw new Error("POS er ikke koblet til en virksomhed endnu.");
    }
    const payload = stripUndefinedDeep({
      ...scopeData(context),
      ...settings,
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
      updatedBy: context.uid || ""
    });
    await setDoc(posDocPath(context, "pos_settings", "main"), payload, { merge: true });
    await addAudit(context, "pos_settings_updated", {
      paymentMethods: settings.paymentMethods || {},
      hardware: settings.hardware || {},
      cashRegister: settings.cashRegister || {}
    });
    return payload;
  }

  async function saveCashSession(date, reconciliation = {}) {
    if (!cloudEnabled) {
      throw new Error("POS er ikke koblet til en virksomhed endnu.");
    }
    const sessionId = cleanId(date || dateKey(), "session");
    await setDoc(posDocPath(context, "pos_cash_sessions", sessionId), {
      ...scopeData(context),
      sessionId,
      date: date || dateKey(),
      ...reconciliation,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await addAudit(context, "cash_reconciliation_saved", { date, reconciliation });
  }

  async function migrateLocalStorageToFirestore() {
    if (!cloudEnabled) throw new Error("Migration kræver companyId/locationId.");
    const marker = `pos_migration_completed_${context.companyId}_${context.locationId}`;
    if (localStorage.getItem(marker)) return { skipped: true, reason: "already_completed" };
    const backup = Object.fromEntries(LOCAL_KEYS.map((key) => [key, localStorage.getItem(key)]));
    const backupKey = `pos_localStorage_backup_${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(backup));

    const batch = writeBatch(db);
    const products = localProducts();
    const sales = localSales();
    const audit = readLocalJson("pos_audit_log", []);
    const reconciliations = readLocalJson("pos_reconciliations", {});
    let maxReceiptNumber = Number(localStorage.getItem("pos_receipt_sequence") || "0") || 0;

    products.forEach((product) => {
      const normalized = normalizeProduct(product);
      batch.set(posDocPath(context, "pos_products", cleanId(normalized.id)), {
        ...scopeData(context),
        ...normalized,
        migratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    sales.forEach((sale) => {
      const id = cleanId(sale.id || `sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      maxReceiptNumber = Math.max(maxReceiptNumber, Number(sale.receiptNumber || 0) || 0);
      const payment = normalizePayment(sale.payment, sale.paymentMethod);
      batch.set(posDocPath(context, "pos_sales", id), {
        ...scopeData(context),
        ...sale,
        id,
        payment,
        paymentMethod: payment.method,
        businessSnapshot: normalizeBusinessSnapshot(sale.businessSnapshot || sale.business, businessSnapshot),
        business: normalizeBusinessSnapshot(sale.business || sale.businessSnapshot, businessSnapshot),
        migratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      if (payment.method !== "cash") {
        batch.set(posDocPath(context, "pos_payment_reconciliations", id), {
          ...scopeData(context),
          saleId: id,
          receiptNumber: sale.receiptNumber || "",
          receiptLabel: sale.receiptLabel || "",
          totalInclVat: sale.totalInclVat || 0,
          payment,
          status: payment.reconciliationStatus || "pending",
          migratedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });

    audit.forEach((entry) => {
      const id = cleanId(entry.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      batch.set(posDocPath(context, "pos_audit_log", id), {
        ...scopeData(context),
        ...entry,
        migratedAt: serverTimestamp()
      }, { merge: true });
    });

    Object.entries(reconciliations || {}).forEach(([date, reconciliation]) => {
      batch.set(posDocPath(context, "pos_cash_sessions", cleanId(date, "session")), {
        ...scopeData(context),
        sessionId: cleanId(date, "session"),
        date,
        ...(reconciliation || {}),
        migratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    await runTransaction(db, async (transaction) => {
      const ref = posDocPath(context, "pos_receipt_sequences", "main");
      const snap = await transaction.get(ref);
      const current = snap.exists() ? Number(snap.data().lastNumber || 0) : 0;
      transaction.set(ref, {
        ...scopeData(context),
        lastNumber: Math.max(current, maxReceiptNumber),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
    await addAudit(context, "localStorage_migrated", {
      backupKey,
      products: products.length,
      sales: sales.length,
      audit: audit.length,
      reconciliations: Object.keys(reconciliations || {}).length
    });
    localStorage.setItem(marker, new Date().toISOString());
    return { ok: true, backupKey, products: products.length, sales: sales.length };
  }

  return {
    context,
    businessSnapshot,
    cloudEnabled,
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    listSales,
    createSale,
    updateSalePayment,
    createPaymentSession,
    updatePaymentSession,
    getZettleSettings,
    getPosSettings,
    savePosSettings,
    saveCashSession,
    migrateLocalStorageToFirestore
  };
}

export { DEFAULT_PRODUCTS, dateKey, formatReceiptNumber };
