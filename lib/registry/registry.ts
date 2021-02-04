export default abstract class Registry {
  abstract registerWorker(): Promise<void>;
  abstract unRegisterWorker(): Promise<void>;
}
