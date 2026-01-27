//! # Vibe-API
//!
//! The HTTP/WebSocket API layer powered by Axum.
//! Provides idempotent endpoints for data ingestion and querying.
//!
//! ## Endpoints
//!
//! - `POST /v1/push/:collection` - Insert data with auto-schema evolution
//! - `GET /v1/query/:collection` - Query data from a collection
//! - `GET /v1/tables` - List all tables
//! - `GET /v1/tables/:collection` - Get table stats
//! - `GET /v1/stream/:collection` - SSE stream for real-time updates
//! - `GET /explore` - Vibe-Explorer dashboard

use crate::db::{json_to_sql_value, SqlValue, VibeStore};
use crate::error::VibeError;
use crate::guard::SchemaGuard;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{sse::Event, IntoResponse, Sse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{debug, info};

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    pub store: Arc<VibeStore>,
    pub guard: Arc<SchemaGuard>,
    /// Broadcast channel for real-time updates per table
    pub broadcasters: Arc<dashmap::DashMap<String, broadcast::Sender<Value>>>,
}

impl AppState {
    pub fn new(store: Arc<VibeStore>) -> Self {
        let guard = Arc::new(SchemaGuard::new(Arc::clone(&store)));
        Self {
            store,
            guard,
            broadcasters: Arc::new(dashmap::DashMap::new()),
        }
    }

    /// Get or create a broadcaster for a collection
    fn get_broadcaster(&self, collection: &str) -> broadcast::Sender<Value> {
        self.broadcasters
            .entry(collection.to_string())
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(100);
                tx
            })
            .clone()
    }
}

/// Standard API response
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    pub fn success_with_message(data: T, message: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: Some(message.into()),
        }
    }
}

/// Push response data
#[derive(Debug, Serialize)]
pub struct PushResponse {
    pub id: i64,
    pub collection: String,
    pub columns_added: Vec<String>,
}

/// Batch push response
#[derive(Debug, Serialize)]
pub struct BatchPushResponse {
    pub inserted: u64,
    pub collection: String,
    pub columns_added: Vec<String>,
}

/// Query parameters for GET requests
#[derive(Debug, Deserialize)]
pub struct QueryParams {
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
    #[serde(default)]
    pub order_by: Option<String>,
    #[serde(default)]
    pub order_dir: Option<String>,
    #[serde(flatten)]
    pub filters: HashMap<String, String>,
}

/// Table stats response
#[derive(Debug, Serialize)]
pub struct TableStatsResponse {
    pub name: String,
    pub column_count: usize,
    pub row_count: u64,
    pub columns: Vec<ColumnResponse>,
}

#[derive(Debug, Serialize)]
pub struct ColumnResponse {
    pub name: String,
    pub col_type: String,
    pub nullable: bool,
    pub primary_key: bool,
}

/// Creates the Axum router with all endpoints
pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Data endpoints
        .route("/v1/push/:collection", post(push_handler))
        .route("/v1/push/:collection/batch", post(batch_push_handler))
        .route("/v1/query/:collection", get(query_handler))
        .route("/v1/query/:collection/:id", get(get_by_id_handler))
        .route("/v1/update/:collection/:id", post(update_handler))
        .route("/v1/delete/:collection/:id", post(delete_handler))
        // SQL Control endpoints
        .route("/v1/sql/query", post(sql_query_handler))
        .route("/v1/sql/execute", post(sql_execute_handler))
        // Meta endpoints
        .route("/v1/tables", get(list_tables_handler))
        .route("/v1/tables/:collection", get(table_stats_handler))
        // Real-time streaming
        .route("/v1/stream/:collection", get(stream_handler))
        // Health check
        .route("/health", get(health_handler))
        .route("/", get(root_handler))
        // Middleware
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Root handler - API info
async fn root_handler() -> impl IntoResponse {
    Json(json!({
        "name": "VibeDB",
        "version": "1.0.0",
        "description": "🛸 Schema-Later Database with Automatic Evolution",
        "endpoints": {
            "push": "POST /v1/push/:collection",
            "batch_push": "POST /v1/push/:collection/batch",
            "query": "GET /v1/query/:collection",
            "get_by_id": "GET /v1/query/:collection/:id",
            "update": "POST /v1/update/:collection/:id",
            "delete": "POST /v1/delete/:collection/:id",
            "tables": "GET /v1/tables",
            "table_stats": "GET /v1/tables/:collection",
            "stream": "GET /v1/stream/:collection",
            "health": "GET /health",
            "explorer": "GET /explore"
        }
    }))
}

/// Health check endpoint
async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    match state.store.query_simple("SELECT 1".to_string()).await {
        Ok(_) => Json(json!({
            "status": "healthy",
            "database": "connected"
        })),
        Err(e) => Json(json!({
            "status": "unhealthy",
            "database": "disconnected",
            "error": e.to_string()
        })),
    }
}

/// POST /v1/push/:collection - Insert a single document
async fn push_handler(
    State(state): State<AppState>,
    Path(collection): Path<String>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, VibeError> {
    info!("📥 Pushing to collection: {}", collection);

    // Ensure table exists
    state.guard.ensure_table(&collection).await?;

    // Ensure columns exist and get insertable column names
    let columns = state.guard.ensure_columns(&collection, &payload).await?;

    if columns.is_empty() {
        // Insert with only default values
        let sql = format!("INSERT INTO {} DEFAULT VALUES", collection);
        state.store.execute_simple(sql).await?;
    } else {
        // Build INSERT statement
        let placeholders: Vec<&str> = columns.iter().map(|_| "?").collect();
        let sql = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            collection,
            columns.join(", "),
            placeholders.join(", ")
        );

        // Convert JSON values to SQL values
        let obj = payload.as_object().ok_or_else(|| {
            VibeError::InvalidPayload("Payload must be a JSON object".to_string())
        })?;

        let params: Vec<SqlValue> = columns
            .iter()
            .map(|col| {
                obj.get(col)
                    .map(json_to_sql_value)
                    .unwrap_or(SqlValue::Null)
            })
            .collect();

        debug!("Executing: {} with {} params", sql, params.len());
        state.store.execute(sql, params).await?;
    }

    // Get the inserted ID
    let id = state.store.last_insert_rowid().await?;

    // Broadcast the new data
    let tx = state.get_broadcaster(&collection);
    let _ = tx.send(json!({
        "event": "insert",
        "id": id,
        "data": payload
    }));

    let response = ApiResponse::success_with_message(
        PushResponse {
            id,
            collection: collection.clone(),
            columns_added: columns,
        },
        "Data pushed successfully",
    );

    Ok((StatusCode::CREATED, Json(response)))
}

/// POST /v1/push/:collection/batch - Insert multiple documents
async fn batch_push_handler(
    State(state): State<AppState>,
    Path(collection): Path<String>,
    Json(payloads): Json<Vec<Value>>,
) -> Result<impl IntoResponse, VibeError> {
    info!(
        "📥 Batch pushing {} items to collection: {}",
        payloads.len(),
        collection
    );

    if payloads.is_empty() {
        return Err(VibeError::InvalidPayload("Empty batch".to_string()));
    }

    // Ensure table exists
    state.guard.ensure_table(&collection).await?;

    // Process all payloads to ensure all columns exist
    let mut all_columns: std::collections::HashSet<String> = std::collections::HashSet::new();
    for payload in &payloads {
        let columns = state.guard.ensure_columns(&collection, payload).await?;
        all_columns.extend(columns);
    }

    let columns: Vec<String> = all_columns.into_iter().collect();
    let mut inserted = 0u64;

    if columns.is_empty() {
        // Insert with only default values
        for _ in &payloads {
            let sql = format!("INSERT INTO {} DEFAULT VALUES", collection);
            state.store.execute_simple(sql).await?;
            inserted += 1;
        }
    } else {
        let placeholders: Vec<&str> = columns.iter().map(|_| "?").collect();
        let sql = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            collection,
            columns.join(", "),
            placeholders.join(", ")
        );

        for payload in &payloads {
            let obj = payload.as_object().ok_or_else(|| {
                VibeError::InvalidPayload("Each item must be a JSON object".to_string())
            })?;

            let params: Vec<SqlValue> = columns
                .iter()
                .map(|col| {
                    obj.get(col)
                        .map(json_to_sql_value)
                        .unwrap_or(SqlValue::Null)
                })
                .collect();

            state.store.execute(sql.clone(), params).await?;
            inserted += 1;
        }
    }

    // Broadcast batch insert
    let tx = state.get_broadcaster(&collection);
    let _ = tx.send(json!({
        "event": "batch_insert",
        "count": inserted
    }));

    let response = ApiResponse::success(BatchPushResponse {
        inserted,
        collection,
        columns_added: columns,
    });

    Ok((StatusCode::CREATED, Json(response)))
}

/// GET /v1/query/:collection - Query documents with filters
async fn query_handler(
    State(state): State<AppState>,
    Path(collection): Path<String>,
    Query(params): Query<QueryParams>,
) -> Result<impl IntoResponse, VibeError> {
    debug!("🔍 Querying collection: {}", collection);

    // Check if table exists
    let _stats = state.guard.get_table_stats(&collection).await?;

    // Build query
    let mut sql = format!("SELECT * FROM {}", collection);
    let mut query_params: Vec<SqlValue> = Vec::new();

    // Add WHERE clauses from filters (excluding reserved params)
    let reserved = ["limit", "offset", "order_by", "order_dir"];
    let filters: Vec<_> = params
        .filters
        .iter()
        .filter(|(k, _)| !reserved.contains(&k.as_str()))
        .collect();

    if !filters.is_empty() {
        let conditions: Vec<String> = filters.iter().map(|(k, _)| format!("{} = ?", k)).collect();
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));

        for (_, v) in filters {
            query_params.push(SqlValue::Text(v.clone()));
        }
    }

    // Add ORDER BY
    if let Some(order_by) = &params.order_by {
        SchemaGuard::validate_identifier(order_by)?;
        let dir = params.order_dir.as_deref().unwrap_or("ASC").to_uppercase();
        if dir != "ASC" && dir != "DESC" {
            return Err(VibeError::InvalidPayload(
                "order_dir must be ASC or DESC".to_string(),
            ));
        }
        sql.push_str(&format!(" ORDER BY {} {}", order_by, dir));
    }

    // Add LIMIT and OFFSET
    let limit = params.limit.unwrap_or(100).min(1000);
    sql.push_str(&format!(" LIMIT {}", limit));
    if let Some(offset) = params.offset {
        sql.push_str(&format!(" OFFSET {}", offset));
    }

    // Execute query
    let rows = state.store.query(sql, query_params).await?;

    let results: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let mut obj = serde_json::Map::new();
            for (key, value) in row {
                obj.insert(key, value);
            }
            Value::Object(obj)
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": results,
        "count": results.len(),
        "collection": collection
    })))
}

/// GET /v1/query/:collection/:id - Get single document by ID
async fn get_by_id_handler(
    State(state): State<AppState>,
    Path((collection, id)): Path<(String, i64)>,
) -> Result<impl IntoResponse, VibeError> {
    debug!("🔍 Getting {} from {}", id, collection);

    let _stats = state.guard.get_table_stats(&collection).await?;

    let sql = format!("SELECT * FROM {} WHERE id = ?", collection);
    let rows = state.store.query(sql, vec![SqlValue::Integer(id)]).await?;

    if let Some(row) = rows.into_iter().next() {
        let mut obj = serde_json::Map::new();
        for (key, value) in row {
            obj.insert(key, value);
        }

        Ok(Json(json!({
            "success": true,
            "data": Value::Object(obj)
        })))
    } else {
        Err(VibeError::TableNotFound(format!(
            "Document with id {} not found in {}",
            id, collection
        )))
    }
}

/// POST /v1/update/:collection/:id - Update a document
async fn update_handler(
    State(state): State<AppState>,
    Path((collection, id)): Path<(String, i64)>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, VibeError> {
    info!("📝 Updating {} in {}", id, collection);

    // Ensure columns exist
    let columns = state.guard.ensure_columns(&collection, &payload).await?;

    if columns.is_empty() {
        return Ok(Json(json!({
            "success": true,
            "message": "No updates provided"
        })));
    }

    let obj = payload.as_object().ok_or_else(|| {
        VibeError::InvalidPayload("Payload must be a JSON object".to_string())
    })?;

    // Build UPDATE statement
    let set_clauses: Vec<String> = columns.iter().map(|c| format!("{} = ?", c)).collect();
    let sql = format!(
        "UPDATE {} SET {}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        collection,
        set_clauses.join(", ")
    );

    let mut params: Vec<SqlValue> = columns
        .iter()
        .map(|col| {
            obj.get(col)
                .map(json_to_sql_value)
                .unwrap_or(SqlValue::Null)
        })
        .collect();
    params.push(SqlValue::Integer(id));

    let affected = state.store.execute(sql, params).await?;

    // Broadcast update
    let tx = state.get_broadcaster(&collection);
    let _ = tx.send(json!({
        "event": "update",
        "id": id,
        "data": payload
    }));

    Ok(Json(json!({
        "success": true,
        "affected": affected,
        "id": id
    })))
}

/// POST /v1/delete/:collection/:id - Delete a document
async fn delete_handler(
    State(state): State<AppState>,
    Path((collection, id)): Path<(String, i64)>,
) -> Result<impl IntoResponse, VibeError> {
    info!("🗑️ Deleting {} from {}", id, collection);

    let sql = format!("DELETE FROM {} WHERE id = ?", collection);
    let affected = state.store.execute(sql, vec![SqlValue::Integer(id)]).await?;

    // Broadcast delete
    let tx = state.get_broadcaster(&collection);
    let _ = tx.send(json!({
        "event": "delete",
        "id": id
    }));

    Ok(Json(json!({
        "success": true,
        "affected": affected,
        "id": id
    })))
}

/// GET /v1/tables - List all tables
async fn list_tables_handler(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, VibeError> {
    let tables = state.store.list_tables().await?;

    Ok(Json(json!({
        "success": true,
        "tables": tables,
        "count": tables.len()
    })))
}

/// GET /v1/tables/:collection - Get table stats
async fn table_stats_handler(
    State(state): State<AppState>,
    Path(collection): Path<String>,
) -> Result<impl IntoResponse, VibeError> {
    let stats = state.guard.get_table_stats(&collection).await?;

    let columns: Vec<ColumnResponse> = stats
        .columns
        .iter()
        .map(|c| ColumnResponse {
            name: c.name.clone(),
            col_type: c.col_type.clone(),
            nullable: !c.notnull,
            primary_key: c.pk,
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": TableStatsResponse {
            name: stats.name,
            column_count: stats.column_count,
            row_count: stats.row_count,
            columns,
        }
    })))
}

/// GET /v1/stream/:collection - Server-Sent Events stream
async fn stream_handler(
    State(state): State<AppState>,
    Path(collection): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    info!("📡 New stream subscriber for: {}", collection);

    let tx = state.get_broadcaster(&collection);
    let mut rx = tx.subscribe();

    let stream = async_stream::stream! {
        // Send initial connection message
        yield Ok(Event::default().data(json!({
            "event": "connected",
            "collection": collection
        }).to_string()));

        // Stream updates
        loop {
            match rx.recv().await {
                Ok(value) => {
                    yield Ok(Event::default().data(value.to_string()));
                }
                Err(broadcast::error::RecvError::Closed) => break,
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    yield Ok(Event::default().data(json!({
                        "event": "warning",
                        "message": format!("Missed {} messages", n)
                    }).to_string()));
                }
            }
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    )
}

/// SQL Request
#[derive(Debug, Deserialize)]
pub struct SqlRequest {
    pub query: String,
}

/// POST /v1/sql/query - Execute a SQL query and return rows
async fn sql_query_handler(
    State(state): State<AppState>,
    Json(payload): Json<SqlRequest>,
) -> Result<impl IntoResponse, VibeError> {
    info!("🔍 Executing Raw SQL Query: {}", payload.query);
    
    // Safety check? For now, we allow everything as requested by "USER: control everything"
    let rows = state.store.query_simple(payload.query).await?;
    
    // Transform specifically to look generic
    let results: Vec<Value> = rows.into_iter().map(|row| {
         let mut obj = serde_json::Map::new();
         for (key, value) in row {
             obj.insert(key, value);
         }
         Value::Object(obj)
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": results,
        "count": results.len()
    })))
}

/// POST /v1/sql/execute - Execute a SQL statement (DDL/DML)
async fn sql_execute_handler(
    State(state): State<AppState>,
    Json(payload): Json<SqlRequest>,
) -> Result<impl IntoResponse, VibeError> {
    info!("⚡ Executing Raw SQL Statement: {}", payload.query);

    let affected = state.store.execute_simple(payload.query).await?;
    
    Ok(Json(json!({
        "success": true,
        "affected": affected
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::util::ServiceExt;

    async fn create_test_app() -> Router {
        let store = Arc::new(VibeStore::in_memory().await.unwrap());
        let state = AppState::new(store);
        create_router(state)
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let app = create_test_app().await;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_push_and_query() {
        let store = Arc::new(VibeStore::in_memory().await.unwrap());
        let state = AppState::new(store);
        let app = create_router(state);

        // Push data
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/push/users")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name": "Alice", "age": 30}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::CREATED);

        // Query data
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/query/users")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
