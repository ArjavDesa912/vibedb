//! # Database Module (Vibe-Store)
//!
//! Manages the persistent .db file using WAL mode for concurrent high-throughput.
//! This module handles database initialization, connection management, and provides
//! utilities for executing queries safely.

use crate::error::{VibeError, VibeResult};
use std::path::Path;
use tokio_rusqlite::Connection;
use rusqlite::TransactionBehavior;
use tracing::{debug, info};

/// Row data returned from queries
pub type RowData = Vec<(String, rusqlite::types::Value)>;

/// The Vibe-Store: manages database connections and provides query utilities
pub struct VibeStore {
    conn: Connection,
    path: String,
}

impl VibeStore {
    /// Creates a new VibeStore with the specified database path
    ///
    /// # Arguments
    /// * `path` - Path to the SQLite database file
    ///
    /// # Returns
    /// A configured VibeStore with WAL mode enabled
    pub async fn new<P: AsRef<Path>>(path: P) -> VibeResult<Self> {
        let path_str = path.as_ref().to_string_lossy().to_string();
        info!("Initializing VibeDB at: {}", path_str);

        let conn = Connection::open(&path_str)
            .await
            .map_err(|e| VibeError::Database(format!("Failed to open database: {}", e)))?;

        // Initialize with production-ready pragmas
        Self::initialize_pragmas(&conn).await?;

        info!("✨ VibeDB initialized successfully with WAL mode");

        Ok(Self {
            conn,
            path: path_str,
        })
    }

    /// Creates an in-memory database (useful for testing)
    pub async fn in_memory() -> VibeResult<Self> {
        info!("Initializing in-memory VibeDB");

        let conn = Connection::open_in_memory()
            .await
            .map_err(|e| VibeError::Database(format!("Failed to create database: {}", e)))?;

        Self::initialize_pragmas(&conn).await?;

        Ok(Self {
            conn,
            path: ":memory:".to_string(),
        })
    }

    /// Initialize database with production-ready pragmas
    ///
    /// As per the specification:
    /// - PRAGMA journal_mode=WAL; (for concurrent high-throughput)
    /// - PRAGMA synchronous=NORMAL; (balance between safety and speed)
    async fn initialize_pragmas(conn: &Connection) -> VibeResult<()> {
        debug!("Setting up database pragmas...");

        conn.call(|conn| {
            conn.execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA synchronous=NORMAL;
                 PRAGMA foreign_keys=ON;
                 PRAGMA cache_size=-64000;",
            )?;
            Ok(())
        })
        .await
        .map_err(|e| VibeError::Database(format!("Failed to set pragmas: {}", e)))?;

        debug!("Database pragmas configured successfully");
        Ok(())
    }

    /// Get the connection
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Execute a write query (INSERT, UPDATE, DELETE, ALTER)
    pub async fn execute(&self, sql: String, params: Vec<SqlValue>) -> VibeResult<u64> {
        self.conn
            .call(move |conn| {
                let params_refs: Vec<&dyn rusqlite::ToSql> = params
                    .iter()
                    .map(|p| p as &dyn rusqlite::ToSql)
                    .collect();
                let affected = conn.execute(&sql, params_refs.as_slice())?;
                Ok(affected as u64)
            })
            .await
            .map_err(|e| VibeError::Database(format!("Execute failed: {}", e)))
    }

    /// Execute a simple query without parameters
    pub async fn execute_simple(&self, sql: String) -> VibeResult<u64> {
        self.conn
            .call(move |conn| {
                let affected = conn.execute(&sql, [])?;
                Ok(affected as u64)
            })
            .await
            .map_err(|e| VibeError::Database(format!("Execute failed: {}", e)))
    }

    /// Execute batch SQL
    pub async fn execute_batch(&self, sql: String) -> VibeResult<()> {
        self.conn
            .call(move |conn| {
                conn.execute_batch(&sql)?;
                Ok(())
            })
            .await
            .map_err(|e| VibeError::Database(format!("Batch execution failed: {}", e)))
    }

    /// Query and return rows as JSON-like structure
    pub async fn query(
        &self,
        sql: String,
        params: Vec<SqlValue>,
    ) -> VibeResult<Vec<Vec<(String, serde_json::Value)>>> {
        self.conn
            .call(move |conn| {
                let mut stmt = conn.prepare(&sql)?;
                let column_names: Vec<String> = stmt
                    .column_names()
                    .iter()
                    .map(|s| s.to_string())
                    .collect();

                let params_refs: Vec<&dyn rusqlite::ToSql> = params
                    .iter()
                    .map(|p| p as &dyn rusqlite::ToSql)
                    .collect();

                let mut rows_result = Vec::new();
                let rows = stmt.query(params_refs.as_slice())?;
                let mut rows = rows;

                while let Some(row) = rows.next()? {
                    let mut row_data = Vec::new();
                    for (i, name) in column_names.iter().enumerate() {
                        let value = Self::get_value_from_row(row, i);
                        row_data.push((name.clone(), value));
                    }
                    rows_result.push(row_data);
                }

                Ok(rows_result)
            })
            .await
            .map_err(|e| VibeError::Database(format!("Query failed: {}", e)))
    }

    /// Query without parameters
    pub async fn query_simple(
        &self,
        sql: String,
    ) -> VibeResult<Vec<Vec<(String, serde_json::Value)>>> {
        self.query(sql, vec![]).await
    }

    /// Helper to extract value from a row
    fn get_value_from_row(row: &rusqlite::Row, idx: usize) -> serde_json::Value {
        // Try integer first
        if let Ok(v) = row.get::<_, i64>(idx) {
            return serde_json::json!(v);
        }
        // Try float
        if let Ok(v) = row.get::<_, f64>(idx) {
            return serde_json::json!(v);
        }
        // Try string
        if let Ok(v) = row.get::<_, String>(idx) {
            // Try to parse as JSON if it looks like JSON
            if v.starts_with('{') || v.starts_with('[') {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&v) {
                    return parsed;
                }
            }
            return serde_json::json!(v);
        }
        // Try blob
        if let Ok(v) = row.get::<_, Vec<u8>>(idx) {
            return serde_json::json!(format!("<blob:{} bytes>", v.len()));
        }
        // Null
        serde_json::Value::Null
    }

    /// Get the database file path
    pub fn path(&self) -> &str {
        &self.path
    }

    /// Check if database is in-memory
    pub fn is_in_memory(&self) -> bool {
        self.path == ":memory:"
    }

    /// Get all table names in the database
    pub async fn list_tables(&self) -> VibeResult<Vec<String>> {
        let rows = self
            .query_simple(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                    .to_string(),
            )
            .await?;

        let tables: Vec<String> = rows
            .iter()
            .filter_map(|row| {
                row.first().and_then(|(_, v)| v.as_str().map(|s| s.to_string()))
            })
            .collect();

        Ok(tables)
    }

    /// Get last insert rowid
    pub async fn last_insert_rowid(&self) -> VibeResult<i64> {
        self.conn
            .call(|conn| Ok(conn.last_insert_rowid()))
            .await
            .map_err(|e| VibeError::Database(format!("Failed to get last rowid: {}", e)))
    }

    /// Execute with transaction
    pub async fn with_transaction<F, T>(&self, f: F) -> VibeResult<T>
    where
        F: FnOnce(&rusqlite::Connection) -> Result<T, rusqlite::Error> + Send + 'static,
        T: Send + 'static,
    {
        self.conn
            .call(move |conn| {
                let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
                let result = f(&tx)?;
                tx.commit()?;
                Ok(result)
            })
            .await
            .map_err(|e| VibeError::Database(format!("Transaction failed: {}", e)))
    }
}

/// SQL Value wrapper for parameters
#[derive(Debug, Clone)]
pub enum SqlValue {
    Null,
    Integer(i64),
    Real(f64),
    Text(String),
    Blob(Vec<u8>),
}

impl rusqlite::ToSql for SqlValue {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        match self {
            SqlValue::Null => Ok(rusqlite::types::ToSqlOutput::Owned(
                rusqlite::types::Value::Null,
            )),
            SqlValue::Integer(i) => Ok(rusqlite::types::ToSqlOutput::Owned(
                rusqlite::types::Value::Integer(*i),
            )),
            SqlValue::Real(f) => Ok(rusqlite::types::ToSqlOutput::Owned(
                rusqlite::types::Value::Real(*f),
            )),
            SqlValue::Text(s) => Ok(rusqlite::types::ToSqlOutput::Owned(
                rusqlite::types::Value::Text(s.clone()),
            )),
            SqlValue::Blob(b) => Ok(rusqlite::types::ToSqlOutput::Owned(
                rusqlite::types::Value::Blob(b.clone()),
            )),
        }
    }
}

/// Convert JSON value to SqlValue
pub fn json_to_sql_value(value: &serde_json::Value) -> SqlValue {
    match value {
        serde_json::Value::Null => SqlValue::Null,
        serde_json::Value::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqlValue::Real(f)
            } else {
                SqlValue::Text(n.to_string())
            }
        }
        serde_json::Value::String(s) => SqlValue::Text(s.clone()),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            SqlValue::Text(serde_json::to_string(value).unwrap_or_default())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_in_memory_db() {
        let store = VibeStore::in_memory().await.unwrap();
        assert!(store.is_in_memory());

        // Test basic query
        let tables = store.list_tables().await.unwrap();
        assert!(tables.is_empty());
    }

    #[tokio::test]
    async fn test_create_and_query() {
        let store = VibeStore::in_memory().await.unwrap();

        // Create a table
        store
            .execute_simple(
                "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)".to_string(),
            )
            .await
            .unwrap();

        // Insert data
        store
            .execute(
                "INSERT INTO test (name) VALUES (?)".to_string(),
                vec![SqlValue::Text("VibeDB".to_string())],
            )
            .await
            .unwrap();

        // Query data
        let rows = store
            .query_simple("SELECT name FROM test".to_string())
            .await
            .unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0][0].1, serde_json::json!("VibeDB"));
    }
}
