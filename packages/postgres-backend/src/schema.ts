/**
 * SQL schema for PostgreSQL Agenda jobs table
 */

export function getCreateTableSQL(tableName: string): string {
	return `
		CREATE TABLE IF NOT EXISTS "${tableName}" (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			priority INTEGER NOT NULL DEFAULT 0,
			next_run_at TIMESTAMPTZ,
			type VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'single')),
			locked_at TIMESTAMPTZ,
			last_finished_at TIMESTAMPTZ,
			failed_at TIMESTAMPTZ,
			fail_count INTEGER DEFAULT NULL,
			fail_reason TEXT,
			repeat_timezone VARCHAR(100),
			last_run_at TIMESTAMPTZ,
			repeat_interval VARCHAR(255),
			data JSONB DEFAULT '{}'::jsonb,
			repeat_at VARCHAR(255),
			disabled BOOLEAN DEFAULT FALSE,
			progress REAL,
			fork BOOLEAN DEFAULT FALSE,
			last_modified_by VARCHAR(255),
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		);
	`;
}

export function getCreateIndexesSQL(tableName: string): string[] {
	return [
		// Main index for finding and locking next job
		`CREATE INDEX IF NOT EXISTS "${tableName}_find_and_lock_idx"
		 ON "${tableName}" (name, next_run_at, priority DESC, locked_at, disabled)
		 WHERE disabled = FALSE`,

		// Index for single jobs (upsert operations)
		`CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_single_job_idx"
		 ON "${tableName}" (name) WHERE type = 'single'`,

		// Index for querying by locked_at (for stale lock detection)
		`CREATE INDEX IF NOT EXISTS "${tableName}_locked_at_idx"
		 ON "${tableName}" (locked_at) WHERE locked_at IS NOT NULL`,

		// Index for next_run_at queries (queue size, scheduled jobs)
		`CREATE INDEX IF NOT EXISTS "${tableName}_next_run_at_idx"
		 ON "${tableName}" (next_run_at) WHERE next_run_at IS NOT NULL`
	];
}

export function getDropTableSQL(tableName: string): string {
	return `DROP TABLE IF EXISTS "${tableName}" CASCADE;`;
}

/**
 * Function and trigger for automatic updated_at timestamp
 */
export function getUpdateTimestampTriggerSQL(tableName: string): string {
	return `
		CREATE OR REPLACE FUNCTION update_${tableName}_updated_at()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;

		DROP TRIGGER IF EXISTS "${tableName}_updated_at_trigger" ON "${tableName}";

		CREATE TRIGGER "${tableName}_updated_at_trigger"
		BEFORE UPDATE ON "${tableName}"
		FOR EACH ROW
		EXECUTE FUNCTION update_${tableName}_updated_at();
	`;
}
