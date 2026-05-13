const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

/**
 * Cloud Function: closeDailyRun (v2)
 * Closes the current day's run, generates a daily report, and archives all data
 */
exports.closeDailyRun = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at lukke dagen.");
    }

    const { companyId, locationId, dateKey } = request.data;

    if (!companyId || !locationId || !dateKey) {
      throw new HttpsError(
        "invalid-argument",
        "companyId, locationId og dateKey er påkrævet."
      );
    }

    try {
      // 1. Find daily run
      const runQuery = await db
        .collection("daily_runs")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("dateKey", "==", dateKey)
        .limit(1)
        .get();

      if (runQuery.empty) {
        throw new HttpsError(
          "not-found",
          "Ingen aktiv dag fundet for denne dato."
        );
      }

      const runDoc = runQuery.docs[0];
      const runData = runDoc.data();

      if (runData.status === "closed") {
        throw new HttpsError(
          "failed-precondition",
          "Dagen er allerede lukket."
        );
      }

      // 2. Validate: Check for open deviations
      const openDeviationsQuery = await db
        .collection("deviations")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("status", "==", "open")
        .get();

      const openDeviations = openDeviationsQuery.docs.filter((doc) => {
        const dev = doc.data();
        const createdDate = dev.createdAt?.toDate?.();
        if (!createdDate) return false;
        const devDateKey = createdDate.toISOString().split("T")[0];
        return devDateKey === dateKey;
      });

      if (openDeviations.length > 0) {
        throw new HttpsError(
          "failed-precondition",
          `Du mangler at udbedre ${openDeviations.length} afvigelse${openDeviations.length > 1 ? "r" : ""}, før dagen kan lukkes.`
        );
      }

      // 3. Validate: Check for incomplete tasks
      const taskInstancesQuery = await db
        .collection("task_instances")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("dateKey", "==", dateKey)
        .get();

      // Get task entries for completion check
      const taskEntriesSnapshot = await db
        .collection("task_entries")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("dateKey", "==", dateKey)
        .get();

      const taskEntriesData = taskEntriesSnapshot.docs.map(doc => doc.data());

      // Get deviations for completion check
      const allDeviationsSnapshot = await db
        .collection("deviations")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .get();

      const allDeviationsData = allDeviationsSnapshot.docs.map(doc => doc.data());

      function isTaskCompletedForClosure(task) {
        const status = task.status || "";
        
        // Check status fields
        if (status === "completed" || status === "failed") return true;
        if (status === "not_in_use" || status === "not_applicable") return true;
        if (status === "done" || status === "closed") return true;
        
        // Check timestamp fields (backward compatibility)
        if (task.completedAt) return true;
        if (task.handledAt) return true;
        if (task.resolvedAt) return true;
        if (task.archivedAt) return true;
        
        // Check registration flags
        if (task.registrationCompleted === true) return true;
        if (task.registrationDeferred === true) return true;
        
        // Check if has task entry
        const hasEntry = taskEntriesData.some(e =>
          e.taskInstanceId === task.id || e.taskId === task.taskId
        );
        if (hasEntry) return true;
        
        // Check if has resolved deviation
        const relatedDeviation = allDeviationsData.find(d =>
          d.taskInstanceId === task.id ||
          d.sourceTaskInstanceId === task.id ||
          d.taskId === task.taskId
        );
        if (relatedDeviation && (relatedDeviation.status === "resolved" || relatedDeviation.status === "closed")) {
          return true;
        }
        
        return false;
      }

      const incompleteTasks = taskInstancesQuery.docs.filter((doc) => {
        const task = { id: doc.id, ...doc.data() };
        return !isTaskCompletedForClosure(task);
      });

      if (incompleteTasks.length > 0) {
        throw new HttpsError(
          "failed-precondition",
          `Du har ${incompleteTasks.length} ufuldførte rutine${incompleteTasks.length > 1 ? "r" : ""}. Fuldfør alle opgaver før lukning.`
        );
      }

      // 4. Collect all data for report
      const taskInstances = taskInstancesQuery.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      const deviationsQuery = await db
        .collection("deviations")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .get();

      const deviations = deviationsQuery.docs
        .filter((doc) => {
          const dev = doc.data();
          const createdDate = dev.createdAt?.toDate?.();
          if (!createdDate) return false;
          const devDateKey = createdDate.toISOString().split("T")[0];
          return devDateKey === dateKey;
        })
        .map((doc) => ({
          id: doc.id,
          sourceCollection: "deviations",
          ...doc.data()
        }));

      const alertsDeviationsQuery = await db
        .collection("alerts")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .get();

      const alertsDeviations = alertsDeviationsQuery.docs
        .filter((doc) => {
          const alert = doc.data();
          const createdDate = alert.createdAt?.toDate?.();
          if (!createdDate) return false;
          const alertDateKey = createdDate.toISOString().split("T")[0];
          return alertDateKey === dateKey;
        })
        .map((doc) => ({
          id: doc.id,
          sourceCollection: "alerts",
          ...doc.data()
        }));

      const allDeviations = [...deviations, ...alertsDeviations];

      const taskEntriesQuery = await db
        .collection("task_entries")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("dateKey", "==", dateKey)
        .get();

      const taskEntries = taskEntriesQuery.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      const alertsQuery = await db
        .collection("alerts")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("dateKey", "==", dateKey)
        .get();

      const alerts = alertsQuery.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      // 5. Generate daily report document
      const reportId = `${locationId}__${dateKey}`;
      const reportData = {
        companyId,
        locationId,
        dateKey,
        createdAt: FieldValue.serverTimestamp(),
        closedBy: request.auth.uid,

        summary: {
          totalTasks: taskInstances.length,
          completedTasks: taskInstances.filter((t) => t.status === "completed").length,
          failedTasks: taskInstances.filter((t) => t.status === "failed").length,
          openAlerts: alerts.filter((a) => a.status === "open").length,
          resolvedAlerts: alerts.filter((a) => a.status === "resolved").length
        },

        reportData: {
          taskInstances,
          taskEntries,
          alerts,
          deviations: allDeviations
        },

    metadata: {
  dailyRunId: runDoc.id,
  startedAt: runData.startedAt || null,
  closedAt: FieldValue.serverTimestamp()
}
      };

      // 6. Save report to daily_reports collection
      await db.collection("daily_reports").doc(reportId).set(reportData);

      // 7. Update daily_run status to closed
      await runDoc.ref.update({
        status: "closed",
        closedAt: FieldValue.serverTimestamp(),
        closedBy: request.auth.uid,
        reportId,
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        reportId,
        message: "Dagen er afsluttet og rapport gemt"
      };
    } catch (error) {
      console.error("Fejl ved lukning af dag:", error);

      if (error.code) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error.message || "Ukendt fejl ved lukning af dag"
      );
    }
  }
);