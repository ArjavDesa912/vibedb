//! # Error Handling Module
//!
//! Provides structured error types for VibeDB operations.
//! All errors are propagated with meaningful messages for API consumers.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Result type alias for VibeDB operations
pub type VibeResult<T> = Result<T, VibeError>;

/// Comprehensive error type for all VibeDB operations
#[derive(Error, Debug)]
pub enum VibeError {
    /// Database connection or query errors
    #[error("Database error: {0}")]
    Database(String),

    /// JSON parsing or serialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// Invalid table or column name
    #[error("Invalid identifier: {0}")]
    InvalidIdentifier(String),

    /// Schema validation errors
    #[error("Schema error: {0}")]
    Schema(String),

    /// Column limit exceeded (max 1000 per table)
    #[error("Column limit exceeded: {message}")]
    ColumnLimitExceeded { message: String },

    /// Table not found
    #[error("Table not found: {0}")]
    TableNotFound(String),

    /// Invalid payload structure
    #[error("Invalid payload: {0}")]
    InvalidPayload(String),

    /// Migration error
    #[error("Migration failed: {0}")]
    MigrationFailed(String),

    /// Internal server error
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),

    // =========== Auth & Storage Errors ===========
    
    /// Authentication failed
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    /// Resource conflict (e.g., user already exists)
    #[error("Conflict: {0}")]
    Conflict(String),

    /// Resource not found
    #[error("Not found: {0}")]
    NotFound(String),

    /// Storage error
    #[error("Storage error: {0}")]
    Storage(String),
}

impl VibeError {
    /// Returns the appropriate HTTP status code for this error
    pub fn status_code(&self) -> StatusCode {
        match self {
            VibeError::Database(_) => StatusCode::SERVICE_UNAVAILABLE,
            VibeError::Json(_) => StatusCode::BAD_REQUEST,
            VibeError::InvalidIdentifier(_) => StatusCode::BAD_REQUEST,
            VibeError::Schema(_) => StatusCode::UNPROCESSABLE_ENTITY,
            VibeError::ColumnLimitExceeded { .. } => StatusCode::BAD_REQUEST,
            VibeError::TableNotFound(_) => StatusCode::NOT_FOUND,
            VibeError::InvalidPayload(_) => StatusCode::BAD_REQUEST,
            VibeError::MigrationFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
            VibeError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            VibeError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            VibeError::Conflict(_) => StatusCode::CONFLICT,
            VibeError::NotFound(_) => StatusCode::NOT_FOUND,
            VibeError::Storage(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Returns a machine-readable error code
    pub fn error_code(&self) -> &'static str {
        match self {
            VibeError::Database(_) => "DATABASE_ERROR",
            VibeError::Json(_) => "JSON_ERROR",
            VibeError::InvalidIdentifier(_) => "INVALID_IDENTIFIER",
            VibeError::Schema(_) => "SCHEMA_ERROR",
            VibeError::ColumnLimitExceeded { .. } => "COLUMN_LIMIT_EXCEEDED",
            VibeError::TableNotFound(_) => "TABLE_NOT_FOUND",
            VibeError::InvalidPayload(_) => "INVALID_PAYLOAD",
            VibeError::MigrationFailed(_) => "MIGRATION_FAILED",
            VibeError::Internal(_) => "INTERNAL_ERROR",
            VibeError::Unauthorized(_) => "UNAUTHORIZED",
            VibeError::Conflict(_) => "CONFLICT",
            VibeError::NotFound(_) => "NOT_FOUND",
            VibeError::Storage(_) => "STORAGE_ERROR",
        }
    }
}

/// Converts VibeError into an Axum HTTP response
impl IntoResponse for VibeError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = Json(json!({
            "error": {
                "code": self.error_code(),
                "message": self.to_string(),
            },
            "success": false,
        }));

        (status, body).into_response()
    }
}

/// Convert rusqlite errors to VibeError
impl From<rusqlite::Error> for VibeError {
    fn from(err: rusqlite::Error) -> Self {
        VibeError::Database(err.to_string())
    }
}

/// Convert tokio-rusqlite errors to VibeError
impl From<tokio_rusqlite::Error> for VibeError {
    fn from(err: tokio_rusqlite::Error) -> Self {
        VibeError::Database(err.to_string())
    }
}
