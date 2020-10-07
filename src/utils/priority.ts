/**
 * Internal method to turn priority into a number
 * @name Job#priority
 * @function
 * @param {String|Number} priority string to parse into number
 * @returns {Number} priority that was parsed
 */
export const parsePriority = priority => {
	const priorityMap = {
		lowest: -20,
		low: -10,
		normal: 0,
		high: 10,
		highest: 20
	};
	if (typeof priority === 'number' || priority instanceof Number) {
		return priority;
	}

	return priorityMap[priority];
};
