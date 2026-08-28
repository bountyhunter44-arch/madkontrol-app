// payment-webhook — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const Stripe = require("stripe");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");

module.exports = ({
  FieldValue,
  db
}) => {
  const api = {};

function normalizePurchasedModules(value) {
  const aliases = { accounting: "bogforing", bogfoering: "bogforing", "bogføring": "bogforing" };
  const allowed = new Set(["egenkontrol", "pos", "lagerkontrol", "bogforing", "menu", "seo", "kalkulation", "koerselskontrol"]);
  return [...new Set(String(value || "").split(",")
    .map((item) => String(item || "").trim().toLowerCase())
    .map((item) => aliases[item] || item)
    .filter((item) => allowed.has(item)))];
}

api.stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    let event;

    try {
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        console.error("âŒ Missing Stripe signature");
        return res.status(400).send("Missing signature");
      }

      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("âŒ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("âœ… Stripe event:", event.type);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const companyId = session.metadata?.companyId;
          const locationId = session.metadata?.locationId;
          const purchasedModules = normalizePurchasedModules(session.metadata?.selectedModules);

          if (!companyId) break;

          const subscriptionUpdate = {
            "subscription.plan": session.metadata?.plan || "unknown",
            "subscription.status": "active",
            "subscription.stripeCustomerId": session.customer,
            "subscription.stripeSubscriptionId": session.subscription,
            "subscription.updatedAt": FieldValue.serverTimestamp()
          };
          if (purchasedModules.length) {
            subscriptionUpdate["subscription.selectedModules"] = FieldValue.arrayUnion(...purchasedModules);
            subscriptionUpdate.activeModules = FieldValue.arrayUnion(...purchasedModules);
            subscriptionUpdate.selectedModules = FieldValue.arrayUnion(...purchasedModules);
            purchasedModules.forEach((moduleKey) => {
              subscriptionUpdate[`moduleAccess.${moduleKey}.enabled`] = true;
              subscriptionUpdate[`moduleAccess.${moduleKey}.status`] = "active";
              subscriptionUpdate[`moduleAccess.${moduleKey}.source`] = "stripe_checkout";
              subscriptionUpdate[`moduleAccess.${moduleKey}.activatedAt`] = FieldValue.serverTimestamp();
            });
          }

          await db.collection("companies").doc(companyId).set(subscriptionUpdate, { merge: true });
          if (locationId && purchasedModules.length) {
            await db.collection("companies").doc(companyId).collection("locations").doc(locationId).set({
              activeModules: FieldValue.arrayUnion(...purchasedModules),
              selectedModules: FieldValue.arrayUnion(...purchasedModules),
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          }

          if (session.metadata?.source === "direct_module_purchase" && session.metadata?.uid) {
            const uid = String(session.metadata.uid).trim();
            const convertedAt = FieldValue.serverTimestamp();
            const conversionPatch = {
              isDemo: false,
              demoMode: false,
              demoExpiresAt: FieldValue.delete(),
              demoExpiryProcessed: FieldValue.delete(),
              demoAuthDisabled: FieldValue.delete(),
              active: true,
              isActive: true,
              archived: false,
              status: "active",
              accessStatus: "active",
              registrationWriteLocked: false,
              ownerKind: "real_owner",
              ownerLabel: "Rigtig owner",
              isDemoScope: false,
              scopeType: "customer",
              convertedFromDemoAt: convertedAt,
              updatedAt: convertedAt
            };
            const conversionWrites = [
              db.collection("companies").doc(companyId).set(conversionPatch, { merge: true }),
              db.collection("users").doc(uid).set({
                ...conversionPatch,
                subscriptionStatus: "active"
              }, { merge: true }),
              db.collection("companies").doc(companyId).collection("members").doc(uid).set(conversionPatch, { merge: true })
            ];
            if (locationId) {
              conversionWrites.push(
                db.collection("locations").doc(locationId).set(conversionPatch, { merge: true }),
                db.collection("companies").doc(companyId).collection("locations").doc(locationId).set(conversionPatch, { merge: true })
              );
            }
            await Promise.all(conversionWrites);
            try {
              await admin.auth().updateUser(uid, { disabled: false });
            } catch (error) {
              console.error("Kunne ikke genaktivere demo-bruger efter betaling:", error);
            }
          }

          const checkoutSnap = await db.collection("checkout_sessions")
            .where("stripeSessionId", "==", session.id)
            .limit(10)
            .get();
          await Promise.all(checkoutSnap.docs.map((checkoutDoc) => checkoutDoc.ref.set({
            status: "completed",
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true })));
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", sub.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": sub.status,
              "subscription.currentPeriodEnd": sub.current_period_end,
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", sub.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": "canceled",
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", invoice.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": "payment_failed",
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object;

          const snap = await db
            .collection("companies")
            .where("subscription.stripeCustomerId", "==", invoice.customer)
            .get();

          for (const doc of snap.docs) {
            await doc.ref.update({
              "subscription.status": "active",
              "subscription.updatedAt": FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        default:
          console.log("Unhandled event type:", event.type);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("âŒ Webhook handler error:", error);
      res.status(500).send("Server error");
    }
  }
);

  return api;
};
