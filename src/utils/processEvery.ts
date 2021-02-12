import humanInterval = require('human-interval');

export function calculateProcessEvery(input: number | string = 5000): number {
	if (typeof input === 'number') return input;
	return (humanInterval(input) as number) || 5000;
}
