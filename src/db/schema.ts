import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('syndicom.db');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const database = getDatabase();

  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  await database.execAsync(`
    -- ─── Profiles ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      push_token TEXT,
      system_role TEXT NOT NULL DEFAULT 'user'
        CHECK(system_role IN ('superuser', 'user')),
      force_password_change INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── Residences ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS residences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      currency TEXT DEFAULT 'DH',
      apartment_count INTEGER DEFAULT 0,
      monthly_fee REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── User Residences ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_residences (
      user_id TEXT NOT NULL,
      residence_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'resident')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, residence_id),
      FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE
    );

    -- ─── Apartments ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS apartments (
      id TEXT PRIMARY KEY,
      residence_id TEXT NOT NULL,
      number TEXT NOT NULL,
      floor INTEGER,
      owner_name TEXT,
      phone TEXT,
      email TEXT,
      whatsapp TEXT,
      resident_user_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE
    );

    -- ─── Contributions ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      residence_id TEXT NOT NULL,
      apartment_id TEXT NOT NULL,
      month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
      year INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      paid INTEGER DEFAULT 0,
      paid_at TEXT,
      comment TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(apartment_id, month, year),
      FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE,
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
    );

    -- ─── Payment Declarations ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payment_declarations (
      id TEXT PRIMARY KEY,
      residence_id TEXT NOT NULL,
      apartment_id TEXT NOT NULL,
      declared_by TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'validated', 'rejected')),
      validated_by TEXT,
      validated_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE,
      FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
    );

    -- ─── Expenses ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      residence_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      receipt_url TEXT,
      deleted INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE
    );

    -- ─── Sync Queue ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('INSERT','UPDATE','DELETE')),
      payload TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── Activity Log ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      residence_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Migrations : ajouter colonnes manquantes avant la création des index ─────────
  await runMigrations(database);

  await database.execAsync(`
    -- ─── Indexes ─────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_profiles_system_role ON profiles(system_role);
    CREATE INDEX IF NOT EXISTS idx_user_residences_user ON user_residences(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_residences_residence ON user_residences(residence_id);
    CREATE INDEX IF NOT EXISTS idx_apartments_residence ON apartments(residence_id);
    CREATE INDEX IF NOT EXISTS idx_apartments_resident_user ON apartments(resident_user_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_residence ON contributions(residence_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_apartment ON contributions(apartment_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_year_month ON contributions(year, month);
    CREATE INDEX IF NOT EXISTS idx_expenses_residence ON expenses(residence_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_payment_declarations_apartment ON payment_declarations(apartment_id);
    CREATE INDEX IF NOT EXISTS idx_payment_declarations_status ON payment_declarations(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
  `);

  console.log('[DB] SQLite v2 initialized');
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Ajouter colonnes email/whatsapp/resident_user_id à apartments si absentes
  const aptCols = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(apartments)"
  );
  const aptColNames = aptCols.map(c => c.name);

  if (!aptColNames.includes('email')) {
    await database.execAsync('ALTER TABLE apartments ADD COLUMN email TEXT;');
  }
  if (!aptColNames.includes('whatsapp')) {
    await database.execAsync('ALTER TABLE apartments ADD COLUMN whatsapp TEXT;');
  }
  if (!aptColNames.includes('resident_user_id')) {
    await database.execAsync('ALTER TABLE apartments ADD COLUMN resident_user_id TEXT;');
  }

  // Ajouter colonne force_password_change à profiles si absente
  const profCols = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(profiles)"
  );
  const profColNames = profCols.map(c => c.name);
  if (!profColNames.includes('force_password_change')) {
    await database.execAsync('ALTER TABLE profiles ADD COLUMN force_password_change INTEGER DEFAULT 0;');
  }

  // Créer profiles si n'existe pas (table très ancienne)
  const tables = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  const tableNames = tables.map(t => t.name);

  if (!tableNames.includes('user_residences')) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS user_residences (
        user_id TEXT NOT NULL,
        residence_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'resident')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, residence_id)
      );
    `);
  }

  if (!tableNames.includes('payment_declarations')) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS payment_declarations (
        id TEXT PRIMARY KEY,
        residence_id TEXT NOT NULL,
        apartment_id TEXT NOT NULL,
        declared_by TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'validated', 'rejected')),
        validated_by TEXT,
        validated_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  console.log('[DB] Migrations applied');
}
