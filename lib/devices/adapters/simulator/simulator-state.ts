/** In-process simulator runtime state keyed by device id (not physical hardware). */

export type SimulatorDeviceRuntime = {
  paperOut: boolean;
  offline: boolean;
  forcePrintFail: boolean;
  drawerOpen: boolean;
  lastScan?: string;
  displayLines: string[];
  /** Processed payment callback ids to detect duplicates. */
  paymentCallbackIds: Set<string>;
};

const runtime = new Map<string, SimulatorDeviceRuntime>();

export function getSimulatorRuntime(deviceId: string): SimulatorDeviceRuntime {
  let state = runtime.get(deviceId);
  if (!state) {
    state = {
      paperOut: false,
      offline: false,
      forcePrintFail: false,
      drawerOpen: false,
      displayLines: [],
      paymentCallbackIds: new Set(),
    };
    runtime.set(deviceId, state);
  }
  return state;
}

export function resetSimulatorRuntime(deviceId: string): void {
  runtime.delete(deviceId);
}

export function resetAllSimulatorRuntime(): void {
  runtime.clear();
}
