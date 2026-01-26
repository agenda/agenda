export interface AgendaConfig {
	name?: string;

	defaultConcurrency: number;

	processEvery: number;

	maxConcurrency: number;

	defaultLockLimit: number;

	lockLimit: number;

	defaultLockLifetime: number;
}
