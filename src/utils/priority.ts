export type JobPriority = number | keyof typeof priorityMap;

const priorityMap = {
	lowest: -20,
	low: -10,
	normal: 0,
	high: 10,
	highest: 20
};

/**
 * Internal method to turn priority into a number
 * @name Job#priority
 * @function
 * @param {String|Number} priority string to parse into number
 * @returns {Number} priority that was parsed
 */
export function parsePriority(priority?: JobPriority): number {
	if (typeof priority === 'number') {
		return priority;
	}

	if (typeof priority === 'string' && priorityMap[priority]) {
		return priorityMap[priority];
	}

	return priorityMap.normal;
}
