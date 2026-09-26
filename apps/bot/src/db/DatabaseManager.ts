import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseManager {
    private static instance: DatabaseManager;
    private mainDb: BetterSqlite3Database;
    private userDbs: Map<string, { db: BetterSqlite3Database, lastAccessed: number }> = new Map();
    private dataDir: string;
    private usersDir: string;

    // Cache timeout in ms (e.g. 1 hour)
    private readonly CACHE_TIMEOUT = 60 * 60 * 1000;

    private constructor() {
        this.dataDir = path.resolve(__dirname, '../../data');
        this.usersDir = path.join(this.dataDir, 'users');
        
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
        if (!fs.existsSync(this.usersDir)) fs.mkdirSync(this.usersDir, { recursive: true });

        // Initialize Main DB
        const dbPath = path.join(this.dataDir, 'main_v2.db');
        this.mainDb = new Database(dbPath);
        this.mainDb.pragma('journal_mode = WAL');

        // Apply schema
        const schemaPath = path.join(__dirname, 'main_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        this.mainDb.exec(schema);

        console.log(`[DatabaseManager] Main database initialized at ${dbPath}`);

        // Cleanup interval for inactive user DBs
        setInterval(() => this.cleanupInactiveConnections(), 5 * 60 * 1000); // Check every 5 mins
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public getMainDb(): BetterSqlite3Database {
        return this.mainDb;
    }

    public getUserDb(accountId: string): BetterSqlite3Database {
        if (!accountId) throw new Error("Account ID is required to fetch User DB");

        const now = Date.now();
        if (this.userDbs.has(accountId)) {
            const cache = this.userDbs.get(accountId)!;
            cache.lastAccessed = now;
            return cache.db;
        }

        const dbPath = path.join(this.usersDir, `${accountId}.db`);
        const isNew = !fs.existsSync(dbPath);
        
        const userDb = new Database(dbPath);
        userDb.pragma('journal_mode = WAL');

        if (isNew) {
            const schemaPath = path.join(__dirname, 'user_schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            userDb.exec(schema);
            console.log(`[DatabaseManager] Created new user database at ${dbPath}`);
        }

        this.userDbs.set(accountId, { db: userDb, lastAccessed: now });
        return userDb;
    }

    /**
     * Resolves a Discord ID to an Account ID, and optionally fetches their tier.
     * Throws if user is not bound.
     */
    public getAccountByDiscordId(discordId: string) {
        const row = this.mainDb.prepare(`
            SELECT a.account_id, a.tier 
            FROM discord_mappings m
            JOIN accounts a ON m.account_id = a.account_id
            WHERE m.discord_id = ?
        `).get(discordId) as { account_id: string, tier: number } | undefined;
        
        if (!row) {
            throw new Error('USER_NOT_BOUND');
        }
        return row;
    }

    private cleanupInactiveConnections() {
        const now = Date.now();
        for (const [accountId, cache] of this.userDbs.entries()) {
            if (now - cache.lastAccessed > this.CACHE_TIMEOUT) {
                try {
                    cache.db.close();
                    this.userDbs.delete(accountId);
                    console.log(`[DatabaseManager] Closed inactive connection for ${accountId}`);
                } catch (e) {
                    console.error(`[DatabaseManager] Failed to close DB for ${accountId}:`, e);
                }
            }
        }
    }
    
    public closeAll() {
        for (const [accountId, cache] of this.userDbs.entries()) {
            cache.db.close();
        }
        this.userDbs.clear();
        this.mainDb.close();
    }
}

export const dbManager = DatabaseManager.getInstance();
