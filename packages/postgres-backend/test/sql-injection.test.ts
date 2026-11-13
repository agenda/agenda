/**
 * Security regression test: the keys of a `unique` constraint must never be
 * interpolated into raw SQL. Uses a recording mock pool, so it needs no live
 * database.
 */
import { describe, it, expect } from 'vitest';
import { PostgresJobRepository } from '../src/PostgresJobRepository.js';

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
							type: 'normal',
							data: {},
							disabled: false
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

function baseJob(unique: Record<string, unknown>) {
	return {
		name: 'job',
		priority: 0,
		type: 'normal',
		data: {},
		disabled: false,
		unique
	};
}

describe('PostgresJobRepository unique-constraint SQL injection', () => {
	it('binds data.* JSON paths as parameters instead of interpolating them', async () => {
		const { repo, calls } = makeRepo();

		const maliciousPath = "id'; DROP TABLE agenda_jobs; --";
		await repo.saveJob(baseJob({ [`data.${maliciousPath}`]: 'x' }) as never, undefined);

		const select = calls.find(c => /^\s*SELECT/i.test(c.sql));
		expect(select).toBeDefined();
		// The payload must not appear in the SQL text...
		expect(select!.sql).not.toContain('DROP TABLE');
		expect(select!.sql).toContain('data->>$');
		// ...it must travel as a bound parameter value.
		expect(select!.params).toContain(maliciousPath);
	});

	it('rejects direct-column keys that are not known columns', async () => {
		const { repo } = makeRepo();

		await expect(
			repo.saveJob(baseJob({ 'id = 1 or 1=1; --': 'y' }) as never, undefined)
		).rejects.toThrow(/Invalid unique constraint field/);
	});

	it('still accepts legitimate unique constraints', async () => {
		const { repo, calls } = makeRepo();

		await repo.saveJob(
			baseJob({ 'data.entityType': 'products', name: 'job' }) as never,
			undefined
		);

		const select = calls.find(c => /^\s*SELECT/i.test(c.sql));
		expect(select).toBeDefined();
		expect(select!.sql).toContain('data->>$');
		expect(select!.sql).toContain('"name" = $');
		expect(select!.params).toContain('entityType');
		expect(select!.params).toContain('products');
	});
});
