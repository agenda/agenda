/**
 * Date constraints (startDate, endDate, skipDays) must survive a save/read
 * round-trip. Uses a recording mock pool, so it needs no live database.
 */
import { describe, it, expect } from 'vitest';
import { PostgresJobRepository } from '../src/PostgresJobRepository.js';

const startDate = new Date('2026-01-01T00:00:00.000Z');
const endDate = new Date('2026-12-31T00:00:00.000Z');
const skipDays = [0, 6];

interface RecordedCall {
	sql: string;
	params: unknown[];
}

function makeRepo() {
	const calls: RecordedCall[] = [];
	const pool = {
		query(sql: string, params: unknown[] = []) {
			calls.push({ sql, params });
			if (/^\s*INSERT/i.test(sql)) {
				return Promise.resolve({
					rows: [
						{
							id: '00000000-0000-0000-0000-000000000000',
							name: 'job',
							priority: 0,
							next_run_at: null,
							type: 'normal',
							data: {},
							disabled: false,
							start_date: startDate,
							end_date: endDate,
							skip_days: skipDays
						}
					],
					rowCount: 1
				});
			}
			return Promise.resolve({ rows: [], rowCount: 0 });
		}
	};
	const repo = new PostgresJobRepository({ pool: pool as never, ensureSchema: false });
	return { repo, calls };
}

function baseJob(extra: Record<string, unknown>) {
	return {
		name: 'job',
		priority: 0,
		nextRunAt: new Date(),
		type: 'normal',
		data: {},
		startDate,
		endDate,
		skipDays,
		...extra
	};
}

describe('PostgresJobRepository date constraints round-trip', () => {
	it('writes startDate, endDate and skipDays on insert and reads them back', async () => {
		const { repo, calls } = makeRepo();

		const saved = await repo.saveJob(baseJob({}) as never, undefined);

		const insert = calls.find(c => /^\s*INSERT/i.test(c.sql));
		expect(insert).toBeDefined();
		expect(insert!.sql).toContain('start_date');
		expect(insert!.sql).toContain('end_date');
		expect(insert!.sql).toContain('skip_days');
		expect(insert!.params).toContainEqual(startDate);
		expect(insert!.params).toContainEqual(endDate);
		expect(insert!.params).toContainEqual(skipDays);

		expect(saved.startDate).toEqual(startDate);
		expect(saved.endDate).toEqual(endDate);
		expect(saved.skipDays).toEqual(skipDays);
	});

	it('writes the constraints on the single-type upsert', async () => {
		const { repo, calls } = makeRepo();

		await repo.saveJob(baseJob({ type: 'single' }) as never, undefined);

		const upsert = calls.find(c => /ON CONFLICT/i.test(c.sql));
		expect(upsert).toBeDefined();
		expect(upsert!.sql).toContain('start_date = EXCLUDED.start_date');
		expect(upsert!.params).toContainEqual(startDate);
		expect(upsert!.params).toContainEqual(skipDays);
	});
});
