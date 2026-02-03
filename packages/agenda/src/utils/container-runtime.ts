/**
 * Shared container runtime utilities for Docker and Podman
 *
 * This module provides a unified interface for working with both Docker and Podman,
 * abstracting away the differences and providing common operations.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type RuntimeType = 'docker' | 'podman' | null;

export interface ContainerConfig {
	image: string;
	env?: Record<string, string>;
	ports?: Array<{ host: number; container: number }>;
	tmpfs?: string[];
	detached?: boolean;
}

/**
 * Manages container runtime detection and operations for Docker and Podman
 */
export class ContainerRuntime {
	private cachedRuntime: RuntimeType = null;
	private cachedCompose: string | null = null;

	/**
	 * Detects whether Docker or Podman is available on the system
	 * Results are cached after the first detection
	 */
	async detect(): Promise<{ runtime: RuntimeType; compose: string | null }> {
		if (this.cachedRuntime !== null) {
			return { runtime: this.cachedRuntime, compose: this.cachedCompose };
		}

		if (await this._isCommandAvailable('docker')) {
			this.cachedRuntime = 'docker';
			this.cachedCompose = (await this._isCommandAvailable('docker compose')) ? 'docker compose' : null;
			return { runtime: this.cachedRuntime, compose: this.cachedCompose };
		}

		if (await this._isCommandAvailable('podman')) {
			this.cachedRuntime = 'podman';
			this.cachedCompose = (await this._isCommandAvailable('podman compose')) ? 'podman compose' : null;
			return { runtime: this.cachedRuntime, compose: this.cachedCompose };
		}

		this.cachedRuntime = null;
		this.cachedCompose = null;
		return { runtime: null, compose: null };
	}

	/**
	 * Get the detected runtime type
	 */
	async getRuntime(): Promise<RuntimeType> {
		const { runtime } = await this.detect();
		return runtime;
	}

	/**
	 * Get the detected compose command
	 */
	async getCompose(): Promise<string | null> {
		const { compose } = await this.detect();
		return compose;
	}

	/**
	 * Reset the cached runtime detection (useful for testing)
	 */
	reset(): void {
		this.cachedRuntime = null;
		this.cachedCompose = null;
	}

	/**
	 * Start containers using docker-compose or podman-compose
	 */
	async startWithCompose(cwd: string): Promise<void> {
		const compose = await this.getCompose();
		if (!compose) {
			throw new Error('No compose command available');
		}
		await execAsync(`${compose} up -d --wait`, { cwd });
	}

	/**
	 * Stop containers using docker-compose or podman-compose
	 */
	async stopWithCompose(cwd: string): Promise<void> {
		const compose = await this.getCompose();
		if (!compose) {
			throw new Error('No compose command available');
		}
		await execAsync(`${compose} down`, { cwd });
	}

	/**
	 * Check if a container exists and is running
	 */
	async isContainerRunning(containerName: string): Promise<boolean> {
		const runtime = await this.getRuntime();
		if (!runtime) {
			return false;
		}

		try {
			const { stdout } = await execAsync(
				`${runtime} inspect ${containerName} --format='{{.State.Running}}'`,
				{ shell: '/bin/bash' }
			);
			const isRunning = stdout.trim() === "'true'" || stdout.trim() === 'true';
			return isRunning;
		} catch {
			return false;
		}
	}

	/**
	 * Start an existing container
	 */
	async startContainer(containerName: string): Promise<void> {
		const runtime = await this.getRuntime();
		if (!runtime) {
			throw new Error('No container runtime available');
		}
		await execAsync(`${runtime} start ${containerName}`, { shell: '/bin/bash' });
	}

	/**
	 * Stop and remove a container
	 */
	async stopAndRemoveContainer(containerName: string): Promise<void> {
		const runtime = await this.getRuntime();
		if (!runtime) {
			throw new Error('No container runtime available');
		}
		await execAsync(`${runtime} stop ${containerName}`, { shell: '/bin/bash' });
		await execAsync(`${runtime} rm ${containerName}`, { shell: '/bin/bash' });
	}

	/**
	 * Run a new container with the given configuration
	 */
	async runContainer(containerName: string, config: ContainerConfig): Promise<void> {
		const runtime = await this.getRuntime();
		if (!runtime) {
			throw new Error('No container runtime available');
		}

		const envArgs = config.env
			? Object.entries(config.env)
					.map(([key, value]) => `-e ${key}=${value}`)
					.join(' ')
			: '';

		const portArgs = config.ports
			? config.ports.map((p) => `-p ${p.host}:${p.container}`).join(' ')
			: '';

		const tmpfsArgs = config.tmpfs ? config.tmpfs.map((path) => `--tmpfs ${path}`).join(' ') : '';

		const detachedFlag = config.detached !== false ? '-d' : '';

		const cmd = `${runtime} run ${detachedFlag} --name ${containerName} ${envArgs} ${portArgs} ${tmpfsArgs} ${config.image}`
			.trim()
			.replace(/\s+/g, ' ');

		await execAsync(cmd, { shell: '/bin/bash' });
	}

	/**
	 * Check if a command is available
	 */
	private async _isCommandAvailable(cmd: string): Promise<boolean> {
		try {
			await execAsync(`${cmd} --version`);
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Singleton instance for convenience
 */
export const containerRuntime = new ContainerRuntime();
