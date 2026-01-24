/**
 * Test setup for PostgreSQL backend tests
 *
 * This file is automatically loaded by vitest before running tests.
 * It checks for PostgreSQL connection and provides helpful error messages.
 */

import { Pool } from 'pg';

const TEST_URL = process.env.POSTGRES_TEST_URL;

export async function setup() {
	if (!TEST_URL) {
		console.log('\n⚠️  POSTGRES_TEST_URL not set - PostgreSQL tests will be skipped');
		console.log('   To run PostgreSQL tests:');
		console.log('   1. Start the test database: pnpm docker:up');
		console.log('   2. Run tests: pnpm test:postgres');
		console.log('   Or run both: pnpm test:docker\n');
		return;
	}

	// Test connection
	const pool = new Pool({ connectionString: TEST_URL });
	try {
		await pool.query('SELECT 1');
		console.log('\n✓ Connected to PostgreSQL test database\n');
	} catch (error) {
		console.error('\n❌ Failed to connect to PostgreSQL:');
		console.error(`   URL: ${TEST_URL}`);
		console.error(`   Error: ${(error as Error).message}`);
		console.error('\n   Make sure PostgreSQL is running:');
		console.error('   pnpm docker:up\n');
	} finally {
		await pool.end();
	}
}

export async function teardown() {
	// Cleanup if needed
}
