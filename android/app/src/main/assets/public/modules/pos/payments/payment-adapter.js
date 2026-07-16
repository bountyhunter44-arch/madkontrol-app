(function () {
  "use strict";

  function nativePlugin() {
    return window.Capacitor?.Plugins?.MadkontrollenPayments || null;
  }

  function androidRequired() {
    return {
      ok: false,
      status: "unavailable",
      code: "ZETTLE_REQUIRES_ANDROID_APP",
      message: "Zettle betaling kræver Android POS-appen."
    };
  }

  function normalizeSdkNotConfigured(result) {
    if (result?.code === "ZETTLE_SDK_NOT_CONFIGURED") {
      return {
        ...result,
        ok: false,
        status: "unavailable",
        message: "Android POS-appen er klar, men Zettle SDK er ikke koblet på endnu."
      };
    }
    return result;
  }

  async function isNativeAvailable() {
    return Boolean(nativePlugin()?.startZettlePayment);
  }

  async function checkNativePaymentSupport() {
    const plugin = nativePlugin();
    if (!plugin?.checkNativePaymentSupport) return androidRequired();
    const result = await plugin.checkNativePaymentSupport();
    return normalizeSdkNotConfigured(result || {});
  }

  async function startZettlePayment(payload = {}) {
    const plugin = nativePlugin();
    if (!plugin?.startZettlePayment) return androidRequired();
    const result = await plugin.startZettlePayment({
      companyId: payload.companyId || "",
      locationId: payload.locationId || "",
      saleId: payload.saleId || "",
      reference: payload.reference || "",
      amount: Number(payload.amount || 0),
      currency: payload.currency || "DKK",
      readerLinkId: payload.readerLinkId || ""
    });
    return normalizeSdkNotConfigured(result || {});
  }

  window.MadkontrollenPaymentAdapter = {
    isNativeAvailable,
    checkNativePaymentSupport,
    startZettlePayment
  };
})();
