import Registry from "./registry";

export default class MemoryRegistry extends Registry {
  constructor() {
    super();
  }

  workerId?: string;
  machineId?: string;

  machines = [];
  workers = [];

  async registerWorker(): Promise<void> {
    if (!this.machineId) {
      // generate a unique machineId
      const machineId = Math.random().toString();
      this.machineId = machineId;

      // Add to machines
      this.machines.push({
        // @ts-ignore
        id: machineId,
      });
    }

    if (!this.workerId) {
      const workerId = Math.random().toString();
      this.workerId = workerId;

      this.workers.push({
        // @ts-ignore
        id: workerId,
      });
    }
  }

  async unRegisterWorker(): Promise<void> {
    this.workers.splice(
      // @ts-ignore
      this.workers.findIndex((worker) => worker.id === this.workerId)
    );
    this.workerId = undefined;
  }
}
