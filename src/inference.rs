//! # Inference Engine (Schema-Brain)
//!
//! Inspects JSON payloads and maps them to SQLite-compatible types.
//! This module is responsible for ensuring no data is lost during type inference.
//!
//! ## Type Mapping
//!
//! | JSON Type       | SQLite Affinity | Logic/Constraint              |
//! |----------------|-----------------|------------------------------|
//! | Number (Int)   | INTEGER         | Check if `is_i64()`          |
//! | Number (Float) | REAL            | Default for any decimal      |
//! | Boolean        | INTEGER         | Store as 1 or 0              |
//! | String         | TEXT            | Standard UTF-8               |
//! | Object / Array | TEXT (JSON)     | Serialize to String          |
//! | Null           | NULL            | Ignored during column creation |

use crate::error::{VibeError, VibeResult};
use serde_json::Value;

/// SQLite type affinity for column definitions
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SqliteType {
    Integer,
    Real,
    Text,
    Blob,
    Null,
}

impl SqliteType {
    /// Returns the SQL type name for column creation
    pub fn as_sql(&self) -> &'static str {
        match self {
            SqliteType::Integer => "INTEGER",
            SqliteType::Real => "REAL",
            SqliteType::Text => "TEXT",
            SqliteType::Blob => "BLOB",
            SqliteType::Null => "NULL",
        }
    }

    /// Determines if this type can be promoted to another type
    /// Used for schema evolution when types conflict
    pub fn can_promote_to(&self, other: &SqliteType) -> bool {
        match (self, other) {
            // Same type - no promotion needed
            (a, b) if a == b => true,
            // INTEGER can be promoted to REAL
            (SqliteType::Integer, SqliteType::Real) => true,
            // Anything can be promoted to TEXT
            (_, SqliteType::Text) => true,
            // NULL can be promoted to anything
            (SqliteType::Null, _) => true,
            _ => false,
        }
    }

    /// Returns the more general type between two types
    pub fn common_type(a: &SqliteType, b: &SqliteType) -> SqliteType {
        if a == b {
            return a.clone();
        }

        match (a, b) {
            (SqliteType::Null, other) | (other, SqliteType::Null) => other.clone(),
            (SqliteType::Integer, SqliteType::Real) | (SqliteType::Real, SqliteType::Integer) => {
                SqliteType::Real
            }
            // When in doubt, use TEXT (most permissive)
            _ => SqliteType::Text,
        }
    }
}

/// Infers the SQLite type from a JSON value
///
/// # Arguments
/// * `value` - The JSON value to infer type from
///
/// # Returns
/// The corresponding SQLite type affinity
pub fn infer_type(value: &Value) -> SqliteType {
    match value {
        Value::Null => SqliteType::Null,
        Value::Bool(_) => SqliteType::Integer,
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                SqliteType::Integer
            } else {
                SqliteType::Real
            }
        }
        Value::String(_) => SqliteType::Text,
        // Objects and Arrays are stored as JSON strings
        Value::Object(_) | Value::Array(_) => SqliteType::Text,
    }
}

/// Represents a column schema derived from JSON
#[derive(Debug, Clone)]
pub struct InferredColumn {
    pub name: String,
    pub sqlite_type: SqliteType,
    pub is_nested: bool, // True if original value was Object/Array
    pub is_nullable: bool,
}

impl InferredColumn {
    pub fn new(name: String, sqlite_type: SqliteType, is_nested: bool) -> Self {
        Self {
            name,
            sqlite_type,
            is_nested,
            is_nullable: true, // All dynamically added columns are nullable
        }
    }
}

/// Infers the schema from a JSON object
///
/// # Arguments
/// * `value` - The JSON value (must be an object)
///
/// # Returns
/// A vector of inferred columns, or an error if the value is not an object
pub fn infer_schema(value: &Value) -> VibeResult<Vec<InferredColumn>> {
    let obj = value.as_object().ok_or_else(|| {
        VibeError::InvalidPayload("Payload must be a JSON object".to_string())
    })?;

    let columns: Vec<InferredColumn> = obj
        .iter()
        .filter(|(_, v)| !v.is_null()) // Skip null values for column creation
        .map(|(key, val)| {
            let is_nested = matches!(val, Value::Object(_) | Value::Array(_));
            InferredColumn::new(key.clone(), infer_type(val), is_nested)
        })
        .collect();

    Ok(columns)
}

/// Validates a batch of JSON values and infers a unified schema
///
/// # Arguments
/// * `values` - A vector of JSON values (all must be objects)
///
/// # Returns
/// A unified schema that can accommodate all values
pub fn infer_batch_schema(values: &[Value]) -> VibeResult<Vec<InferredColumn>> {
    if values.is_empty() {
        return Ok(vec![]);
    }

    let mut unified_columns: std::collections::HashMap<String, InferredColumn> =
        std::collections::HashMap::new();

    for value in values {
        let columns = infer_schema(value)?;
        for col in columns {
            unified_columns
                .entry(col.name.clone())
                .and_modify(|existing| {
                    // Promote type if needed
                    existing.sqlite_type =
                        SqliteType::common_type(&existing.sqlite_type, &col.sqlite_type);
                    existing.is_nested = existing.is_nested || col.is_nested;
                })
                .or_insert(col);
        }
    }

    Ok(unified_columns.into_values().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_type_inference() {
        assert_eq!(infer_type(&json!(42)), SqliteType::Integer);
        assert_eq!(infer_type(&json!(3.14)), SqliteType::Real);
        assert_eq!(infer_type(&json!("hello")), SqliteType::Text);
        assert_eq!(infer_type(&json!(true)), SqliteType::Integer);
        assert_eq!(infer_type(&json!(null)), SqliteType::Null);
        assert_eq!(infer_type(&json!({"nested": "object"})), SqliteType::Text);
        assert_eq!(infer_type(&json!([1, 2, 3])), SqliteType::Text);
    }

    #[test]
    fn test_schema_inference() {
        let payload = json!({
            "name": "VibeDB",
            "version": 1,
            "rating": 9.5,
            "is_awesome": true,
            "metadata": {"key": "value"}
        });

        let schema = infer_schema(&payload).unwrap();
        assert_eq!(schema.len(), 5);
    }

    #[test]
    fn test_type_promotion() {
        assert!(SqliteType::Integer.can_promote_to(&SqliteType::Real));
        assert!(SqliteType::Integer.can_promote_to(&SqliteType::Text));
        assert!(!SqliteType::Text.can_promote_to(&SqliteType::Integer));
        assert!(SqliteType::Null.can_promote_to(&SqliteType::Integer));
    }
}
