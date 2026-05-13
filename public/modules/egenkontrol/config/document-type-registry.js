export const DOCUMENT_TYPE_REGISTRY = {
  delivery_note: {
    displayName: "Følgeseddel",
    documentKind: "delivery_note",
    positiveKeywords: [
      "følgeseddel",
      "foelgeseddel",
      "folgeseddel",
      "følge seddel",
      "leveringsseddel",
      "delivery note",
      "packing slip",
      "shipment note",
      "ordrenr",
      "ordre nr",
      "varenavn",
      "sku",
      "antal",
      "leveringsmetode",
      "modtager"
    ],
    negativeKeywords: [
      "faktura",
      "fakturanr",
      "regning",
      "moms",
      "vat",
      "pris i alt",
      "totalbeløb",
      "betalingsbetingelser",
      "forfaldsdato",
      "iban"
    ]
  },

  freight_document: {
    displayName: "Fragtbrev",
    documentKind: "freight_document",
    positiveKeywords: [
      "fragtbrev",
      "fragt brev",
      "waybill",
      "consignment note",
      "transportør",
      "fragtmand",
      "tracking"
    ]
  },

  invoice: {
    displayName: "Faktura",
    documentKind: "invoice",
    positiveKeywords: [
      "faktura",
      "fakturanr",
      "faktura nr",
      "regning",
      "moms",
      "vat",
      "subtotal",
      "pris i alt",
      "totalbeløb",
      "betalingsbetingelser",
      "forfaldsdato",
      "iban",
      "betalings-id",
      "betalingsid"
    ],
    requiredSignalsAny: [
      "faktura",
      "fakturanr",
      "moms",
      "vat",
      "pris i alt",
      "totalbeløb",
      "betalingsbetingelser",
      "forfaldsdato"
    ]
  },

  receipt: {
    displayName: "Kvittering",
    documentKind: "receipt",
    positiveKeywords: [
      "kvittering",
      "receipt",
      "betalt",
      "kortbetaling",
      "dankort",
      "mobilepay"
    ]
  },

  maintenance_document: {
    displayName: "Service-/vedligeholdsdokument",
    documentKind: "maintenance_document",
    positiveKeywords: [
      "service",
      "vedligehold",
      "reparation",
      "eftersyn",
      "reservedele",
      "tekniker",
      "serviceaftale"
    ]
  }
};

export function normalizeDocumentText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDocumentTypeFromRegistry(rawText, fallbackType = "") {
  const text = normalizeDocumentText(`${rawText || ""} ${fallbackType || ""}`);

  const hasAny = (keywords = []) =>
    keywords.some((keyword) => text.includes(normalizeDocumentText(keyword)));

  const invoice = DOCUMENT_TYPE_REGISTRY.invoice;
  const delivery = DOCUMENT_TYPE_REGISTRY.delivery_note;
  const freight = DOCUMENT_TYPE_REGISTRY.freight_document;

  const hasDeliverySignal = hasAny(delivery.positiveKeywords);
  const hasFreightSignal = hasAny(freight.positiveKeywords);
  const hasStrongInvoiceSignal = hasAny(invoice.requiredSignalsAny);

  if (hasDeliverySignal && !hasStrongInvoiceSignal) {
    return {
      key: "delivery_note",
      ...delivery,
      confidenceReason: "delivery_keywords_without_invoice_signals"
    };
  }

  if (hasFreightSignal && !hasStrongInvoiceSignal) {
    return {
      key: "freight_document",
      ...freight,
      confidenceReason: "freight_keywords_without_invoice_signals"
    };
  }

  if (hasStrongInvoiceSignal) {
    return {
      key: "invoice",
      ...invoice,
      confidenceReason: "strong_invoice_signals"
    };
  }

  for (const [key, config] of Object.entries(DOCUMENT_TYPE_REGISTRY)) {
    if (hasAny(config.positiveKeywords)) {
      return {
        key,
        ...config,
        confidenceReason: "registry_keyword_match"
      };
    }
  }

  return {
    key: "unknown",
    displayName: "Ukendt dokument",
    documentKind: "unknown",
    confidenceReason: "no_registry_match"
  };
}
