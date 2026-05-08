/**
 * Pure metric calculation utilities used by the Analytics dashboard.
 * Extracted here so they can be unit-tested without rendering React components.
 */

/**
 * Returns the number of incidents per 1,000 vehicles, formatted to one
 * decimal place.  Returns "0" when total is 0 to avoid division-by-zero.
 */
export function fmtRate(count: number, total: number): string {
  if (total === 0) return "0";
  return ((count / total) * 1000).toFixed(1);
}

/**
 * Calculates the overall ADB (Aggressive Driving Behaviour) count from its
 * three constituent behaviours.
 */
export function calcAdb(speeding: number, swerving: number, abruptStopping: number): number {
  return speeding + swerving + abruptStopping;
}

/**
 * Given an array of sub-area summaries, returns the aggregate totals.
 */
export function aggregateSubAreas(subAreas: Array<{
  vehicles: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
  adb: number;
}>) {
  return subAreas.reduce(
    (acc, s) => ({
      vehicles: acc.vehicles + s.vehicles,
      speeding: acc.speeding + s.speeding,
      swerving: acc.swerving + s.swerving,
      abrupt_stopping: acc.abrupt_stopping + s.abrupt_stopping,
      adb: acc.adb + s.adb,
    }),
    { vehicles: 0, speeding: 0, swerving: 0, abrupt_stopping: 0, adb: 0 },
  );
}
