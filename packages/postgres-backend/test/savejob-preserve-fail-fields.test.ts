import { expect, describe, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { toJobId } from 'agenda';
import { PostgresJobRepository } from '../src/PostgresJobRepository.js';
import type { PostgresJobRow } from '../src/types.js';

/**
 * Postgres sibling of mongo #1811: Job.save() strips processor-managed
 * fields via toJson(true), so saveJob() must not overwrite failReason /
 * failCount / failedAt with NULL when the caller did not provide them.
 * The redis backend already only writes those columns when explicitly set;
 * the postgres _id UPDATE path unconditionally NULLed them, wiping failure
 * state the processor had recorded.
 *
 * Uses a stub Pool so no live PostgreSQL is needed: the assertions are on
 * the SQL text and bound parameters the repository sends.
 */
describe('PostgresJobRepository.saveJob preserves fail state', () => {
	const fakeRow: PostgresJobRow = {
		id: '507f1f77bcf86cd799439011',
		name: 'failing-job',
		priority: 0,
		next_run_at: new Date(),
		type: 'normal',
		locked_at: new Date(),
		last_finished_at: null,
		failed_at: new Date('2026-11-20T00:00:00.000Z'),
		fail_count: 3,
		fail_reason: 'boom',
		repeat_timezone: null,
		last_run_at: new Date(),
		repeat_interval: null,
		data: {},
		repeat_at: null,
		disabled: false,
		progress: null,
		fork: false,
		last_modified_by: null,
		debounce_started_at: null,
		start_date: null,
		end_date: null,
		skip_days: null,
		created_at: new Date(),
		updated_at: new Date()
	};

	const query = vi.fn(async () => ({ rows: [fakeRow] }));
	let repository: PostgresJobRepository;

	beforeEach(() => {
		query.mockClear();
		repository = new PostgresJobRepository({
			pool: { query } as unknown as Pool,
			tableName: 'agenda_jobs_test',
			ensureSchema: false
		});
	});

	it('does not touch fail columns when the caller omits them (Job.save() path)', async () => {
		// toJson(true) strips failReason/failCount/failedAt, so they are absent here.
		const saved = await repository.saveJob(
			{
				_id: toJobId('507f1f77bcf86cd799439011'),
				name: 'failing-job',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			},
			undefined
		);

		expect(query).toHaveBeenCalledTimes(1);
		const [sql] = query.mock.calls[0] as unknown as [string, unknown[]];
		expect(sql).toContain('UPDATE');
		expect(sql).not.toContain('fail_reason');
		expect(sql).not.toContain('fail_count');
		expect(sql).not.toContain('failed_at');
		// The row itself still round-trips.
		expect(saved.failCount).toBe(3);
		expect(saved.failReason).toBe('boom');
	});

	it('writes fail columns when the caller provides them explicitly', async () => {
		const failedAt = new Date('2026-11-21T00:00:00.000Z');
		await repository.saveJob(
			{
				_id: toJobId('507f1f77bcf86cd799439011'),
				name: 'failing-job',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {},
				failReason: 'boom',
				failCount: 2,
				failedAt
			},
			undefined
		);

		const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
		expect(sql).toContain('fail_reason');
		expect(sql).toContain('fail_count');
		expect(sql).toContain('failed_at');
		expect(params).toContain('boom');
		expect(params).toContain(2);
		expect(params).toContain(failedAt);
	});

	it('clears fail columns when the caller explicitly passes null', async () => {
		// The explicit nulls are intentional: the repository treats a null
		// passed for a fail column as "clear this column", even though the
		// public JobParameters type only allows string | undefined etc.,
		// so the casts below document that the nulls are deliberate.
		await repository.saveJob(
			{
				_id: toJobId('507f1f77bcf86cd799439011'),
				name: 'failing-job',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {},
				failReason: null as unknown as string,
				failCount: null as unknown as number,
				failedAt: null as unknown as Date
			},
			undefined
		);

		const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
		expect(sql).toContain('fail_reason');
		expect(sql).toContain('fail_count');
		expect(sql).toContain('failed_at');
		// Each fail column is bound to an explicit NULL.
		for (const column of ['fail_reason', 'fail_count', 'failed_at']) {
			const match = sql.match(new RegExp(`${column} = \\$(\\d+)`));
			expect(match).not.toBeNull();
			expect(params[Number(match![1]) - 1]).toBeNull();
		}
	});
});
