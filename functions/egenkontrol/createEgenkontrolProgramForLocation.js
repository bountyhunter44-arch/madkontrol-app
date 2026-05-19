const functions = require("firebase-functions");

module.exports = ({
  db,
  sanitizeString,
  getUserAccessProfile,
  assertSeoGeneratorAccess,
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput
}) =>
  functions.https.onCall(
    { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
    async (request) => {
      const data = request.data || {};

      const authUid = sanitizeString(request.auth?.uid || "", 160);
      const authEmail = sanitizeString(request.auth?.token?.email || request.auth?.email || "", 160);

      let companyId = sanitizeString(data?.companyId || "", 120);
      let locationId = sanitizeString(data?.locationId || "", 120);

      if (!companyId || !locationId) {
        const userAccess = await getUserAccessProfile({
          uid: authUid,
          email: authEmail
        });

        if (!companyId && userAccess.companyId) {
          companyId = userAccess.companyId;
        }

        if (!locationId && userAccess.locationId) {
          locationId = userAccess.locationId;
        }
      }

      await assertSeoGeneratorAccess({
        uid: authUid,
        email: authEmail,
        companyId,
        locationId
      });

      const profile = sanitizeOnboardingProfile(data?.profile || {});
      const riskModel = sanitizeRiskModelInput(data?.riskModel || {});

      if (!profile.companyName) {
        throw new functions.https.HttpsError("invalid-argument", "Virksomhedsnavn mangler");
      }

      const summary = {
        companyName: profile.companyName,
        createdAt: new Date().toISOString()
      };

      const draftRef = await db.collection("onboarding_drafts").add({
        companyId,
        locationId,
        profile,
        riskModel,
        createdAt: new Date(),
        createdBy: authUid
      });

      return {
        ok: true,
        draftId: draftRef.id,
        summary
      };
    }
  );