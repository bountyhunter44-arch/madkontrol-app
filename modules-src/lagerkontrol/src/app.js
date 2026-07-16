export const LAGERKONTROL_MODULE_ID = "lagerkontrol";

export function createLagerkontrolApp(options = {}) {
  return {
    moduleId: LAGERKONTROL_MODULE_ID,
    status: "staging",
    options,
    async start() {
      throw new Error("Lagerkontrol app runtime is not implemented in staging");
    }
  };
}
