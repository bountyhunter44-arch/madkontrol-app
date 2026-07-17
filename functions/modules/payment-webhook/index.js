// payment-webhook — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const Stripe = require("stripe");
const { onRequest } = require("firebase-functions/v2/https");

module.exports = ({
  FieldValue,
  db
}) => {
  const api = {};

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

          if (!companyId) break;

          await db.collection("companies").doc(companyId).set(
            {
              subscription: {
                plan: session.metadata?.plan || "unknown",
                status: "active",
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
                updatedAt: FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
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
