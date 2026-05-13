import app from "./firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

window.MKP = window.MKP || {};

const _functions = getFunctions(app, "europe-west1");

function _call(name) {
  const fn = httpsCallable(_functions, name);
  return (data) => fn(data).then((r) => r.data);
}

window.MKP.ProcessInstances = (function () {
  const startCoolingProcess        = _call("startCoolingProcess");
  const addCoolingMeasurement      = _call("addCoolingMeasurement");
  const completeCoolingProcess     = _call("completeCoolingProcess");
  const startReheatingProcess      = _call("startReheatingProcess");
  const completeReheatingProcess   = _call("completeReheatingProcess");
  const disposeCoolingProcess      = _call("disposeCoolingProcess");
  const startNewCoolingFromReheating = _call("startNewCoolingFromReheating");

  async function loadActiveProcessInstances(data) {
    const fn = httpsCallable(_functions, "loadActiveProcessInstances");
    const result = await fn(data);
    return result.data;
  }

  function calculateDuration(startISO, endISO) {
    if (!startISO) return "";
    const start = new Date(startISO);
    const end   = endISO ? new Date(endISO) : new Date();
    const mins  = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}t ${mins % 60}m`;
  }

  function calculateRemaining(startISO, targetMinutes) {
    if (!startISO || !targetMinutes) return "";
    const elapsed = Math.floor((Date.now() - new Date(startISO)) / 60000);
    const left    = Math.max(0, targetMinutes - elapsed);
    if (left < 60) return `${left} min`;
    return `${Math.floor(left / 60)}t ${left % 60}m`;
  }

  function calculateProgress(startISO, targetMinutes) {
    if (!startISO || !targetMinutes) return 0;
    const elapsed = Math.floor((Date.now() - new Date(startISO)) / 60000);
    return Math.min(100, Math.round((elapsed / targetMinutes) * 100));
  }

  function formatTime(isoString) {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  }

  function showRecoveryOptions() {}
  function showNewCoolingOption() {}

  return {
    startCoolingProcess,
    addCoolingMeasurement,
    completeCoolingProcess,
    startReheatingProcess,
    completeReheatingProcess,
    disposeCoolingProcess,
    startNewCoolingFromReheating,
    loadActiveProcessInstances,
    calculateDuration,
    calculateRemaining,
    calculateProgress,
    formatTime,
    showRecoveryOptions,
    showNewCoolingOption
  };
})();
