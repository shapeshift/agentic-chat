import { promises as fs, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { logger } from '@elizaos/core';

/**
 * Gets the standard Eliza directories
 */
function getElizaDirectories() {
    const homeDir = os.homedir();
    const elizaDir = path.join(homeDir, '.eliza');
    const elizaDbDir = path.join(elizaDir, 'db');
    const envFilePath = path.join(elizaDir, '.env');

    return {
        homeDir,
        elizaDir,
        elizaDbDir,
        envFilePath,
    };
}

/**
 * Ensures the .eliza directory exists
 */
async function ensureElizaDir() {
    const dirs = getElizaDirectories();

    if (!existsSync(dirs.elizaDir)) {
        await fs.mkdir(dirs.elizaDir, { recursive: true });
        logger.info(`Created directory: ${dirs.elizaDir}`);
    }

    return dirs;
}

/**
 * Ensures the .env file exists
 */
async function ensureEnvFile(envFilePath: string) {
    if (!existsSync(envFilePath)) {
        await fs.writeFile(envFilePath, '', { encoding: 'utf8' });
        logger.debug(`Created empty .env file at ${envFilePath}`);
    }
}

/**
 * Sets up and configures PGLite database
 */
async function setupPgLite(elizaDbDir: string, envFilePath: string): Promise<void> {
    try {
        // Ensure the PGLite database directory exists
        if (!existsSync(elizaDbDir)) {
            await fs.mkdir(elizaDbDir, { recursive: true });
            logger.info(`Created PGLite database directory: ${elizaDbDir}`);
        }

        // Ensure .env file exists
        await ensureEnvFile(envFilePath);

        // Store PGLITE_DATA_DIR in the environment file
        await fs.writeFile(envFilePath, `PGLITE_DATA_DIR=${elizaDbDir}\n`, { flag: 'a' });

        // Also set in process.env for the current session
        process.env.PGLITE_DATA_DIR = elizaDbDir;

        logger.success('PGLite configuration saved');
    } catch (error) {
        logger.error('Error setting up PGLite directory:', error);
        throw error;
    }
}

/**
 * Initialize the PGLite client and run migrations
 */
async function initializePgLite(dataDir: string): Promise<void> {
    let client: PGlite | null = null;

    try {
        // Initialize PGLite with explicit extensions
        client = new PGlite({
            dataDir,
            extensions: {
                vector,
                fuzzystrmatch
            }
        });

        // Wait for PGLite to be ready
        await client.waitReady;
        logger.info('PGLite client initialized successfully');

        // Enable the extensions
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
        await client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');
        logger.info('Extensions created successfully');

        // Get migration SQL
        const migrationSQL = await fs.readFile(
            path.resolve(process.cwd(), './drizzle/migrations/20250302132443_init.sql'),
            'utf8'
        );

        // Execute the migration SQL directly
        logger.info('Running database migrations...');
        try {
            // Run the migrations, filtering out the CREATE EXTENSION statements
            const statements = migrationSQL
                .split('--> statement-breakpoint')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt && !stmt.startsWith('CREATE EXTENSION'));

            for (const statement of statements) {
                if (statement) {
                    await client.query(statement);
                }
            }

            logger.success('PGLite migrations completed successfully');
        } catch (migrationError) {
            logger.error('Failed to run migrations:', migrationError);
            throw migrationError;
        }
    } catch (error) {
        logger.error('Failed to initialize PGLite:', error);
        throw error;
    } finally {
        // Close the connection
        if (client) {
            await client.close();
        }
    }
}

async function main() {
    try {
        // Get Eliza directories and ensure they exist
        const { elizaDir, elizaDbDir, envFilePath } = await ensureElizaDir();

        logger.info(`Setting up PgLite at ${elizaDbDir}`);

        // Setup PgLite with the directories
        await setupPgLite(elizaDbDir, envFilePath);

        // Initialize PGLite and run migrations
        await initializePgLite(elizaDbDir);

        logger.success('PgLite setup completed successfully');
    } catch (error) {
        logger.error('Error setting up PgLite:', error);
        process.exit(1);
    }
}

// Execute the main function
main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
}); 

