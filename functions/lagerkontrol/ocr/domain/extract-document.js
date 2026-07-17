const { HttpsError } = require("firebase-functions/v2/https");
const { cleanString } = require("../schemas");

async function extractSupplierDocumentFields({ supplierDocument, openAiApiKey }) {
  const seeded = normalizeExistingExtractedFields(
    supplierDocument.extractedFields ||
    supplierDocument.ocrExtracted ||
    supplierDocument.extracted ||
    {}
  );
  const fileUrl = cleanString(
    supplierDocument.fileUrl ||
    supplierDocument.photoUrl ||
    supplierDocument.documentUrl ||
    supplierDocument.supplierDocumentUrl ||
    "",
    2000
  );
  const ocrText = cleanString(
    supplierDocument.ocrText ||
    supplierDocument.rawText ||
    supplierDocument.text ||
    "",
    8000
  );

  if (!openAiApiKey) {
    if (hasUsefulFields(seeded)) {
      return { ...seeded, confidence: seeded.confidence || 0.6, requiresReview: true, source: "existing_fields" };
    }
    throw new HttpsError("failed-precondition", "OPENAI_API_KEY mangler for Lagerkontrol OCR.");
  }

  if (!fileUrl && !ocrText && !hasUsefulFields(seeded)) {
    throw new HttpsError("invalid-argument", "supplier_document mangler fileUrl/photoUrl eller OCR tekst.");
  }

  const aiFields = await callOpenAiForExtraction({ openAiApiKey, fileUrl, ocrText, seeded });
  return normalizeExistingExtractedFields({
    ...seeded,
    ...aiFields,
    source: "openai",
    requiresReview: aiFields.requiresReview !== false || Number(aiFields.confidence || 0) < 0.9
  });
}

async function callOpenAiForExtraction({ openAiApiKey, fileUrl, ocrText, seeded }) {
  const prompt = [
    "Du udtraekker strukturerede felter fra leverandoerdokumenter, fakturaer, fragtbreve, foelgesedler og produktfotos til restaurantlager.",
    "Returner kun valid JSON uden markdown.",
    "Felter: supplier, invoiceNumber, deliveryNoteNumber, productName, quantity, packageUnit, packageSize, packageSizeUnit, price, vatRate, batchNumber, expiryDate, barcode, sku, confidence, requiresReview.",
    "Brug null for ukendte felter. quantity, packageSize, price og vatRate skal vaere tal hvis de kan laeses.",
    "AI maa kun give forslag. Saet requiresReview=true hvis der er tvivl.",
    `Eksisterende felter: ${JSON.stringify(seeded || {})}`,
    ocrText ? `OCR tekst:\n${ocrText}` : ""
  ].filter(Boolean).join("\n\n");

  const content = [{ type: "text", text: prompt }];
  if (fileUrl && isLikelyImageUrl(fileUrl)) {
    content.push({ type: "image_url", image_url: { url: fileUrl } });
  } else if (fileUrl) {
    content.push({ type: "text", text: `Dokument URL: ${fileUrl}` });
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify({
      model: process.env.LAGER_OCR_MODEL || "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Du er en sober dansk OCR-assistent for lager og varemodtagelse. Returner altid kun JSON."
        },
        { role: "user", content }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI OCR fejl ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const raw = String(data?.choices?.[0]?.message?.content || "{}").trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`OCR JSON kunne ikke parses: ${raw.slice(0, 300)}`);
  }
}

function normalizeExistingExtractedFields(input = {}) {
  return {
    supplier: cleanString(input.supplier || input.leverandor || "", 180),
    invoiceNumber: cleanString(input.invoiceNumber || input.invoiceNo || input.fakturaNummer || "", 120),
    deliveryNoteNumber: cleanString(input.deliveryNoteNumber || input.deliveryNo || input.foelgeseddelNummer || "", 120),
    productName: cleanString(input.productName || input.name || input.product || "", 180),
    quantity: toNullableNumber(input.quantity),
    packageUnit: cleanString(input.packageUnit || input.unit || "", 80),
    packageSize: toNullableNumber(input.packageSize || input.weight),
    packageSizeUnit: cleanString(input.packageSizeUnit || input.weightUnit || "", 40),
    price: toNullableNumber(input.price || input.totalPrice || input.total),
    vatRate: toNullableNumber(input.vatRate || input.momsSats),
    batchNumber: cleanString(input.batchNumber || input.batch || input.lot || "", 120),
    expiryDate: cleanString(input.expiryDate || input.bestBefore || "", 80),
    barcode: cleanString(input.barcode || input.ean || "", 120),
    sku: cleanString(input.sku || input.itemNumber || "", 120),
    confidence: toNullableNumber(input.confidence) ?? 0,
    requiresReview: input.requiresReview !== false,
    source: cleanString(input.source || "", 80)
  };
}

function hasUsefulFields(fields = {}) {
  return Boolean(fields.productName || fields.supplier || fields.invoiceNumber || fields.deliveryNoteNumber);
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function isLikelyImageUrl(value) {
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(String(value || "")) || /\/image\/upload\//i.test(String(value || ""));
}

module.exports = {
  extractSupplierDocumentFields,
  normalizeExistingExtractedFields
};
