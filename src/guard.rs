//! # Schema-Later Guard (Migration-Automaton)
//!
//! The "Heart" of VibeDB. This module manages automatic schema evolution by:
//! 1. Caching known schemas using DashMap
//! 2. Detecting missing columns from incoming payloads
//! 3. Generating and executing ALTER TABLE statements
//!
//! ## Execution Loop
//! For every write:
//! 1. **Cache Check**: Check DashMap for known table schema
//! 2. **Live Verify**: On cache miss, run PRAGMA table_info
//! 3. **Diffing**: Compare payload keys against existing columns
//! 4. **Auto-Migration**: Generate ALTER TABLE for missing columns
//! 5. **Validation**: Ensure keys are valid SQL identifiers

use crate::db::VibeStore;
use crate::error::{VibeError, VibeResult};
use crate::inference::infer_type;
use dashmap::DashMap;
use lazy_static::lazy_static;
use regex::Regex;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Maximum columns per table (prevents "Schema Bloat" attacks)
const MAX_COLUMNS_PER_TABLE: usize = 1000;

lazy_static! {
    /// Regex for validating SQL identifiers
    /// Only alphanumeric characters and underscores, must start with letter or underscore
    static ref IDENTIFIER_REGEX: Regex = Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*$").unwrap();

    /// SQL reserved keywords that cannot be used as identifiers
    static ref RESERVED_KEYWORDS: HashSet<&'static str> = {
        let mut set = HashSet::new();
        set.insert("SELECT");
        set.insert("FROM");
        set.insert("WHERE");
        set.insert("INSERT");
        set.insert("UPDATE");
        set.insert("DELETE");
        set.insert("CREATE");
        set.insert("TABLE");
        set.insert("DROP");
        set.insert("ALTER");
        set.insert("INDEX");
        set.insert("AND");
        set.insert("OR");
        set.insert("NOT");
        set.insert("NULL");
        set.insert("TRUE");
        set.insert("FALSE");
        set.insert("PRIMARY");
        set.insert("KEY");
        set.insert("FOREIGN");
        set.insert("REFERENCES");
        set.insert("UNIQUE");
        set.insert("CHECK");
        set.insert("DEFAULT");
        set.insert("AS");
        set.insert("ORDER");
        set.insert("BY");
        set.insert("GROUP");
        set.insert("HAVING");
        set.insert("LIMIT");
        set.insert("OFFSET");
        set.insert("JOIN");
        set.insert("LEFT");
        set.insert("RIGHT");
        set.insert("INNER");
        set.insert("OUTER");
        set.insert("ON");
        set.insert("CASE");
        set.insert("WHEN");
        set.insert("THEN");
        set.insert("ELSE");
        set.insert("END");
        set.insert("UNION");
        set.insert("ALL");
        set.insert("DISTINCT");
        set.insert("VALUES");
        set.insert("SET");
        set.insert("IN");
        set.insert("BETWEEN");
        set.insert("LIKE");
        set.insert("IS");
        set.insert("EXISTS");
        set.insert("EXCEPT");
        set.insert("INTERSECT");
        set
    };
}

/// Column metadata stored in cache
#[derive(Debug, Clone)]
pub struct ColumnInfo {
    pub name: String,
    pub col_type: String,
    pub notnull: bool,
    pub pk: bool,
}

/// Schema Guard - manages automatic schema evolution
pub struct SchemaGuard {
    /// Thread-safe schema cache: table_name -> Vec<column_names>
    schema_cache: DashMap<String, Vec<ColumnInfo>>,
    /// Reference to the database store
    store: Arc<VibeStore>,
}

impl SchemaGuard {
    /// Creates a new SchemaGuard with the given VibeStore
    pub fn new(store: Arc<VibeStore>) -> Self {
        Self {
            schema_cache: DashMap::new(),
            store,
        }
    }

    /// Validates that an identifier is safe for use as a table/column name
    ///
    /// # Rules
    /// - Must match: `^[a-zA-Z_][a-zA-Z0-9_]*$`
    /// - Must not be a SQL reserved keyword
    /// - Maximum length: 128 characters
    pub fn validate_identifier(name: &str) -> VibeResult<()> {
        // Length check
        if name.is_empty() || name.len() > 128 {
            return Err(VibeError::InvalidIdentifier(format!(
                "Identifier '{}' must be 1-128 characters",
                name
            )));
        }

        // Pattern check
        if !IDENTIFIER_REGEX.is_match(name) {
            return Err(VibeError::InvalidIdentifier(format!(
                "Identifier '{}' contains invalid characters. Use only alphanumeric and underscores, starting with a letter or underscore",
                name
            )));
        }

        // Reserved keyword check
        if RESERVED_KEYWORDS.contains(name.to_uppercase().as_str()) {
            return Err(VibeError::InvalidIdentifier(format!(
                "Identifier '{}' is a SQL reserved keyword",
                name
            )));
        }

        Ok(())
    }

    /// Sanitizes a string to be a valid SQL identifier
    /// Replaces invalid characters with underscores
    pub fn sanitize_identifier(name: &str) -> String {
        let sanitized: String = name
            .chars()
            .enumerate()
            .map(|(i, c)| {
                if i == 0 {
                    if c.is_ascii_alphabetic() || c == '_' {
                        c
                    } else {
                        '_'
                    }
                } else if c.is_ascii_alphanumeric() || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();

        // Truncate to max length
        sanitized.chars().take(128).collect()
    }

    /// Gets the current schema for a table from cache or database
    async fn get_table_schema(&self, table: &str) -> VibeResult<Vec<ColumnInfo>> {
        // Cache check first
        if let Some(cached) = self.schema_cache.get(table) {
            debug!("Schema cache hit for table: {}", table);
            return Ok(cached.clone());
        }

        // Cache miss - query database
        debug!("Schema cache miss for table: {}, querying PRAGMA", table);
        let columns = self.fetch_table_info(table).await?;

        // Update cache
        if !columns.is_empty() {
            self.schema_cache.insert(table.to_string(), columns.clone());
        }

        Ok(columns)
    }

    /// Fetches table info using PRAGMA table_info
    async fn fetch_table_info(&self, table: &str) -> VibeResult<Vec<ColumnInfo>> {
        let sql = format!("PRAGMA table_info({})", table);
        let rows = self.store.query_simple(sql).await?;

        let mut columns = Vec::new();
        for row in rows {
            let name = row
                .iter()
                .find(|(k, _)| k == "name")
                .and_then(|(_, v)| v.as_str())
                .unwrap_or_default()
                .to_string();
            let col_type = row
                .iter()
                .find(|(k, _)| k == "type")
                .and_then(|(_, v)| v.as_str())
                .unwrap_or_default()
                .to_string();
            let notnull = row
                .iter()
                .find(|(k, _)| k == "notnull")
                .and_then(|(_, v)| v.as_i64())
                .unwrap_or(0)
                != 0;
            let pk = row
                .iter()
                .find(|(k, _)| k == "pk")
                .and_then(|(_, v)| v.as_i64())
                .unwrap_or(0)
                != 0;

            if !name.is_empty() {
                columns.push(ColumnInfo {
                    name,
                    col_type,
                    notnull,
                    pk,
                });
            }
        }

        Ok(columns)
    }

    /// Ensures a table exists with the base schema
    /// Creates: id, created_at, updated_at columns
    pub async fn ensure_table(&self, table: &str) -> VibeResult<()> {
        Self::validate_identifier(table)?;

        // Check if table exists
        let schema = self.get_table_schema(table).await?;
        if !schema.is_empty() {
            debug!("Table '{}' already exists with {} columns", table, schema.len());
            return Ok(());
        }

        // Create table with base schema
        let create_sql = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            table
        );

        self.store.execute_simple(create_sql).await?;
        info!("✨ Created table: {}", table);

        // Invalidate cache so next call fetches fresh schema
        self.schema_cache.remove(table);

        Ok(())
    }

    /// Ensures all columns from the payload exist in the table
    /// Returns the list of column names that can be used for insertion
    pub async fn ensure_columns(
        &self,
        table: &str,
        payload: &Value,
    ) -> VibeResult<Vec<String>> {
        let obj = payload.as_object().ok_or_else(|| {
            VibeError::InvalidPayload("Payload must be a JSON object".to_string())
        })?;

        // Validate all keys first
        for key in obj.keys() {
            Self::validate_identifier(key)?;
        }

        // Get current schema
        let current_schema = self.get_table_schema(table).await?;
        let existing_columns: HashSet<String> = current_schema
            .iter()
            .map(|c| c.name.clone())
            .collect();

        // Check column limit
        let new_columns: Vec<_> = obj
            .iter()
            .filter(|(key, val)| !val.is_null() && !existing_columns.contains(*key))
            .collect();

        let total_columns = existing_columns.len() + new_columns.len();
        if total_columns > MAX_COLUMNS_PER_TABLE {
            return Err(VibeError::ColumnLimitExceeded {
                message: format!(
                    "Table '{}' would exceed {} column limit ({} existing + {} new = {})",
                    table,
                    MAX_COLUMNS_PER_TABLE,
                    existing_columns.len(),
                    new_columns.len(),
                    total_columns
                ),
            });
        }

        // Add missing columns
        if !new_columns.is_empty() {
            self.add_columns(table, &new_columns).await?;
        }

        // Return column names for insertion (excluding null values and system columns)
        let insert_columns: Vec<String> = obj
            .iter()
            .filter(|(key, val)| {
                !val.is_null() && *key != "id" && *key != "created_at" && *key != "updated_at"
            })
            .map(|(key, _)| key.clone())
            .collect();

        Ok(insert_columns)
    }

    /// Adds new columns to a table
    async fn add_columns(
        &self,
        table: &str,
        columns: &[(&String, &Value)],
    ) -> VibeResult<()> {
        let mut migrations = Vec::new();
        let table_name = table.to_string();

        for (key, val) in columns {
            let sqlite_type = infer_type(val);
            let alter_sql = format!(
                "ALTER TABLE {} ADD COLUMN {} {} DEFAULT NULL",
                table_name,
                key,
                sqlite_type.as_sql()
            );
            migrations.push((key.to_string(), sqlite_type.as_sql().to_string(), alter_sql));
        }

        self.store.with_transaction(move |conn| {
            for (col_name, col_type, sql) in migrations {
                debug!("Executing migration: {}", sql);
                if let Err(e) = conn.execute(&sql, []) {
                    warn!("Failed to add column '{}': {}", col_name, e);
                    return Err(e);
                }
                info!("📊 Added column in tx: {}.{} ({})", table_name, col_name, col_type);
            }
            Ok(())
        }).await?;

        // Invalidate cache
        self.schema_cache.remove(table);

        Ok(())
    }

    /// Gets table statistics
    pub async fn get_table_stats(&self, table: &str) -> VibeResult<TableStats> {
        let schema = self.get_table_schema(table).await?;

        if schema.is_empty() {
            return Err(VibeError::TableNotFound(table.to_string()));
        }

        // Get row count
        let sql = format!("SELECT COUNT(*) as count FROM {}", table);
        let rows = self.store.query_simple(sql).await?;
        let row_count: i64 = rows
            .first()
            .and_then(|r| r.first())
            .and_then(|(_, v)| v.as_i64())
            .unwrap_or(0);

        Ok(TableStats {
            name: table.to_string(),
            column_count: schema.len(),
            row_count: row_count as u64,
            columns: schema,
        })
    }

    /// Clears the schema cache (useful for testing)
    pub fn clear_cache(&self) {
        self.schema_cache.clear();
    }

    /// Gets a list of all cached table names
    pub fn cached_tables(&self) -> Vec<String> {
        self.schema_cache.iter().map(|r| r.key().clone()).collect()
    }
}

/// Table statistics
#[derive(Debug, Clone)]
pub struct TableStats {
    pub name: String,
    pub column_count: usize,
    pub row_count: u64,
    pub columns: Vec<ColumnInfo>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_identifier() {
        // Valid identifiers
        assert!(SchemaGuard::validate_identifier("users").is_ok());
        assert!(SchemaGuard::validate_identifier("_private").is_ok());
        assert!(SchemaGuard::validate_identifier("user_123").is_ok());
        assert!(SchemaGuard::validate_identifier("CamelCase").is_ok());

        // Invalid identifiers
        assert!(SchemaGuard::validate_identifier("123abc").is_err()); // Starts with number
        assert!(SchemaGuard::validate_identifier("user-name").is_err()); // Contains hyphen
        assert!(SchemaGuard::validate_identifier("user name").is_err()); // Contains space
        assert!(SchemaGuard::validate_identifier("SELECT").is_err()); // Reserved keyword
        assert!(SchemaGuard::validate_identifier("").is_err()); // Empty
    }

    #[test]
    fn test_sanitize_identifier() {
        assert_eq!(SchemaGuard::sanitize_identifier("valid_name"), "valid_name");
        assert_eq!(SchemaGuard::sanitize_identifier("123abc"), "_23abc");
        assert_eq!(SchemaGuard::sanitize_identifier("user-name"), "user_name");
        assert_eq!(SchemaGuard::sanitize_identifier("user name"), "user_name");
    }

    #[tokio::test]
    async fn test_ensure_table() {
        let store = Arc::new(VibeStore::in_memory().await.unwrap());
        let guard = SchemaGuard::new(store.clone());

        // Create table
        guard.ensure_table("test_users").await.unwrap();

        // Verify table exists
        let tables = store.list_tables().await.unwrap();
        assert!(tables.contains(&"test_users".to_string()));

        // Verify base columns
        let stats = guard.get_table_stats("test_users").await.unwrap();
        assert_eq!(stats.column_count, 3); // id, created_at, updated_at
    }

    #[tokio::test]
    async fn test_ensure_columns() {
        let store = Arc::new(VibeStore::in_memory().await.unwrap());
        let guard = SchemaGuard::new(store);

        guard.ensure_table("products").await.unwrap();

        let payload = serde_json::json!({
            "name": "Widget",
            "price": 9.99,
            "quantity": 100
        });

        let columns = guard.ensure_columns("products", &payload).await.unwrap();
        assert_eq!(columns.len(), 3);

        // Verify columns were added
        let stats = guard.get_table_stats("products").await.unwrap();
        assert_eq!(stats.column_count, 6); // 3 base + 3 new
    }
}
