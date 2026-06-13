/**
 * Security regression test: a caller-supplied `unique()` constraint must not be
 * able to smuggle server-side-evaluation operators ($where/$function/$expr/
 * $accumulator) into the MongoDB query that drives the upsert. Those operators
 * turn the unique key into a NoSQL-injection vector (server-side JS, DoS, blind
 * matching / cross-record tampering).
 *
 * See BUGS.md (the Mongo unique() hardening section) for the rationale.
 */
import { expect, describe, it, beforeAll, afterAll } from 'vitest';
import { Db, MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { MongoJobRepository, assertSafeUniqueQuery } from '../src/MongoJobRepository.js';

describe('assertSafeUniqueQuery (unit)', () => {
	it('rejects $where at the top level', () => {
		expect(() => assertSafeUniqueQuery({ $where: 'sleep(1000)' })).toThrow(/Unsafe operator/);
	});

	it('rejects evaluation operators nested under a field', () => {
		expect(() => assertSafeUniqueQuery({ 'data.x': { $function: { body: 'x', args: [], lang: 'js' } } })).toThrow(
			/Unsafe operator/
		);
		expect(() => assertSafeUniqueQuery({ 'data.y': { $expr: { $gt: ['$a', '$b'] } } })).toThrow(/Unsafe operator/);
	});

	it('rejects evaluation operators hidden inside an $or array', () => {
		expect(() => assertSafeUniqueQuery({ $or: [{ 'data.a': 1 }, { $where: 'true' }] })).toThrow(/Unsafe operator/);
	});

	it('allows ordinary equality and comparison constraints', () => {
		expect(() => assertSafeUniqueQuery({ 'data.entityType': 'products' })).not.toThrow();
		expect(() => assertSafeUniqueQuery({ 'data.userId': 123, name: 'job' })).not.toThrow();
		expect(() => assertSafeUniqueQuery({ 'data.tags': { $in: ['a', 'b'] } })).not.toThrow();
		expect(() => assertSafeUniqueQuery({ 'data.count': { $ne: 0 } })).not.toThrow();
	});
});

describe('MongoJobRepository unique-constraint NoSQL injection (integration)', () => {
	let client: MongoClient;
	let db: Db;
	let repo: MongoJobRepository;

	beforeAll(async () => {
		const baseUri = process.env.MONGO_URI;
		if (!baseUri) throw new Error('MONGO_URI not set. Ensure global setup is configured.');
		const dbName = `agenda_sec_${randomUUID().replace(/-/g, '')}`;
		const url = new URL(baseUri);
		url.pathname = `/${dbName}`;
		client = await MongoClient.connect(url.toString());
		db = client.db(dbName);
		repo = new MongoJobRepository({ mongo: db });
		await repo.connect();
	});

	afterAll(async () => {
		await db.dropDatabase();
		await client.close();
	});

	const job = (unique: Record<string, unknown>, data: Record<string, unknown> = {}) =>
		({ name: 'job', priority: 0, type: 'normal', data, unique }) as never;

	it('rejects a $where unique constraint before touching the database', async () => {
		await expect(repo.saveJob(job({ $where: 'sleep(1000)' }), undefined)).rejects.toThrow(/Unsafe operator/);
	});

	it('still accepts a legitimate unique constraint', async () => {
		const saved = await repo.saveJob(job({ 'data.entityType': 'products' }, { entityType: 'products' }), undefined);
		expect(saved.name).toBe('job');
		expect(saved._id).toBeDefined();
	});
});
