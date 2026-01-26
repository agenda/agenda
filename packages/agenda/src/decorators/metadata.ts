import type { JobPriority } from '../utils/priority.js';

/**
 * Metadata storage for job decorators
 * Uses a WeakMap to avoid memory leaks and doesn't require reflect-metadata
 */

export interface DefineOptions {
	name?: string;
	concurrency?: number;
	lockLifetime?: number;
	lockLimit?: number;
	priority?: JobPriority;
}

export interface EveryOptions extends DefineOptions {
	timezone?: string;
	skipImmediate?: boolean;
}

export interface ScheduleOptions extends DefineOptions {
	when?: string | Date;
}

export interface JobMetadata {
	type: 'define' | 'every' | 'schedule';
	methodName: string;
	options: DefineOptions | EveryOptions | ScheduleOptions;
	interval?: string | number; // for @Every
}

export interface ControllerMetadata {
	namespace?: string;
	jobs: Map<string, JobMetadata>;
}

/**
 * Type for class constructors used in decorator metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = abstract new (...args: any[]) => any;

/**
 * Registry for storing job controller metadata
 * Uses WeakMap to allow garbage collection of unused classes
 */
const controllerRegistry = new WeakMap<Constructor, ControllerMetadata>();

/**
 * Get or create controller metadata for a class
 */
export function getOrCreateControllerMetadata(target: Constructor): ControllerMetadata {
	let metadata = controllerRegistry.get(target);
	if (!metadata) {
		metadata = { jobs: new Map() };
		controllerRegistry.set(target, metadata);
	}
	return metadata;
}

/**
 * Get controller metadata for a class
 */
export function getControllerMetadata(target: Constructor): ControllerMetadata | undefined {
	return controllerRegistry.get(target);
}

/**
 * Set controller metadata for a class
 */
export function setControllerMetadata(target: Constructor, metadata: ControllerMetadata): void {
	controllerRegistry.set(target, metadata);
}

/**
 * Check if a class is decorated with @JobsController
 */
export function isJobsController(target: Constructor): boolean {
	return controllerRegistry.has(target);
}
