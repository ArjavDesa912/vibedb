//! # Authentication Module (Vibe-Auth)
//!
//! Provides JWT-based authentication for VibeDB, similar to Supabase Auth.
//!
//! ## Features
//! - User signup/login with email and password
//! - Argon2id password hashing
//! - JWT access tokens (short-lived) and refresh tokens (long-lived)
//! - Session management with token refresh
//!
//! ## System Tables
//! - `vibe_users` - Stores user credentials and metadata
//! - `vibe_sessions` - Tracks active refresh tokens

use crate::db::{SqlValue, VibeStore};
use crate::error::{VibeError, VibeResult};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::{header::AUTHORIZATION, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{debug, info};

// ============================================================================
// Configuration Constants
// ============================================================================

/// Default access token expiry (1 hour)
const DEFAULT_ACCESS_TOKEN_DURATION: Duration = Duration::from_secs(3600);

/// Default refresh token expiry (7 days)
const DEFAULT_REFRESH_TOKEN_DURATION: Duration = Duration::from_secs(7 * 24 * 3600);

/// Minimum password length
const MIN_PASSWORD_LENGTH: usize = 8;

// ============================================================================
// Core Types
// ============================================================================

/// Authentication service managing users and sessions
#[derive(Clone)]
pub struct AuthService {
    store: Arc<VibeStore>,
    jwt_secret: Vec<u8>,
    access_token_duration: Duration,
    refresh_token_duration: Duration,
}

/// User data returned from authentication endpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub email: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub metadata: Value,
}

/// Token pair returned after successful authentication
#[derive(Debug, Serialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
    pub user: User,
}

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: i64,
    /// User email
    pub email: String,
    /// Expiration time (Unix timestamp)
    pub exp: u64,
    /// Issued at time (Unix timestamp)
    pub iat: u64,
}

/// Authenticated user extracted from request headers
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: i64,
    pub email: String,
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    #[serde(default)]
    pub metadata: Option<Value>,
}

// ============================================================================
// AuthService Implementation
// ============================================================================

impl AuthService {
    /// Creates a new AuthService with the given store and JWT secret
    pub async fn new(store: Arc<VibeStore>, jwt_secret: Vec<u8>) -> VibeResult<Self> {
        let service = Self {
            store,
            jwt_secret,
            access_token_duration: DEFAULT_ACCESS_TOKEN_DURATION,
            refresh_token_duration: DEFAULT_REFRESH_TOKEN_DURATION,
        };

        // Initialize auth tables
        service.initialize_tables().await?;

        info!("🔐 Vibe-Auth initialized");
        Ok(service)
    }

    /// Initialize authentication tables
    async fn initialize_tables(&self) -> VibeResult<()> {
        // Create users table
        self.store.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS vibe_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_vibe_users_email ON vibe_users(email);
            "#
            .to_string(),
        ).await?;

        // Create sessions table for refresh tokens
        self.store.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS vibe_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                refresh_token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES vibe_users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_vibe_sessions_token ON vibe_sessions(refresh_token);
            CREATE INDEX IF NOT EXISTS idx_vibe_sessions_user ON vibe_sessions(user_id);
            "#
            .to_string(),
        ).await?;

        debug!("Auth tables initialized");
        Ok(())
    }

    /// Generate a secure random JWT secret
    pub fn generate_secret() -> Vec<u8> {
        let mut secret = vec![0u8; 64];
        rand::thread_rng().fill(&mut secret[..]);
        secret
    }

    /// Hash a password using Argon2id
    fn hash_password(&self, password: &str) -> VibeResult<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| VibeError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))
    }

    /// Verify a password against its hash
    fn verify_password(&self, password: &str, hash: &str) -> VibeResult<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| VibeError::Internal(anyhow::anyhow!("Invalid password hash: {}", e)))?;
        
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    /// Generate a JWT access token
    fn generate_access_token(&self, user: &User) -> VibeResult<String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| VibeError::Internal(anyhow::anyhow!("Time error: {}", e)))?;

        let claims = Claims {
            sub: user.id,
            email: user.email.clone(),
            iat: now.as_secs(),
            exp: (now + self.access_token_duration).as_secs(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.jwt_secret),
        )
        .map_err(|e| VibeError::Internal(anyhow::anyhow!("JWT encoding failed: {}", e)))
    }

    /// Generate a secure refresh token
    fn generate_refresh_token(&self) -> String {
        use base64::Engine;
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill(&mut bytes);
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
    }

    /// Validate a JWT access token and return claims
    pub fn validate_token(&self, token: &str) -> VibeResult<Claims> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(&self.jwt_secret),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|e| VibeError::Unauthorized(format!("Invalid token: {}", e)))
    }

    /// Validate email format
    fn validate_email(&self, email: &str) -> VibeResult<()> {
        if !email.contains('@') || email.len() < 5 {
            return Err(VibeError::InvalidPayload("Invalid email format".to_string()));
        }
        Ok(())
    }

    /// Validate password requirements
    fn validate_password(&self, password: &str) -> VibeResult<()> {
        if password.len() < MIN_PASSWORD_LENGTH {
            return Err(VibeError::InvalidPayload(format!(
                "Password must be at least {} characters",
                MIN_PASSWORD_LENGTH
            )));
        }
        Ok(())
    }

    // ========================================================================
    // User Operations
    // ========================================================================

    /// Register a new user
    pub async fn signup(&self, req: SignupRequest) -> VibeResult<AuthTokens> {
        // Validate input
        self.validate_email(&req.email)?;
        self.validate_password(&req.password)?;

        // Check if user already exists
        let existing = self.store.query(
            "SELECT id FROM vibe_users WHERE email = ?".to_string(),
            vec![SqlValue::Text(req.email.clone())],
        ).await?;

        if !existing.is_empty() {
            return Err(VibeError::Conflict("User already exists".to_string()));
        }

        // Hash password
        let password_hash = self.hash_password(&req.password)?;
        let metadata = req.metadata.unwrap_or(json!({}));

        // Insert user
        self.store.execute(
            "INSERT INTO vibe_users (email, password_hash, metadata) VALUES (?, ?, ?)".to_string(),
            vec![
                SqlValue::Text(req.email.clone()),
                SqlValue::Text(password_hash),
                SqlValue::Text(metadata.to_string()),
            ],
        ).await?;

        let user_id = self.store.last_insert_rowid().await?;
        info!("New user registered: {}", req.email);

        // Get the created user
        let user = self.get_user_by_id(user_id).await?;

        // Generate tokens
        self.create_session(user).await
    }

    /// Authenticate a user and return tokens
    pub async fn login(&self, req: LoginRequest) -> VibeResult<AuthTokens> {
        // Find user by email
        let rows = self.store.query(
            "SELECT id, email, password_hash, metadata, created_at, updated_at FROM vibe_users WHERE email = ?"
                .to_string(),
            vec![SqlValue::Text(req.email.clone())],
        ).await?;

        if rows.is_empty() {
            return Err(VibeError::Unauthorized("Invalid credentials".to_string()));
        }

        let row = &rows[0];
        let password_hash = row
            .iter()
            .find(|(k, _)| k == "password_hash")
            .and_then(|(_, v)| v.as_str())
            .ok_or_else(|| VibeError::Internal(anyhow::anyhow!("Missing password_hash")))?;

        // Verify password
        if !self.verify_password(&req.password, password_hash)? {
            return Err(VibeError::Unauthorized("Invalid credentials".to_string()));
        }

        let user = self.row_to_user(row)?;
        info!("User logged in: {}", user.email);

        // Generate tokens
        self.create_session(user).await
    }

    /// Create a new session with tokens
    async fn create_session(&self, user: User) -> VibeResult<AuthTokens> {
        let access_token = self.generate_access_token(&user)?;
        let refresh_token = self.generate_refresh_token();

        // Calculate expiry
        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| VibeError::Internal(anyhow::anyhow!("Time error: {}", e)))?
            + self.refresh_token_duration;

        let expires_at_str = chrono::DateTime::from_timestamp(expires_at.as_secs() as i64, 0)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_default();

        // Store refresh token
        self.store.execute(
            "INSERT INTO vibe_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)"
                .to_string(),
            vec![
                SqlValue::Integer(user.id),
                SqlValue::Text(refresh_token.clone()),
                SqlValue::Text(expires_at_str),
            ],
        ).await?;

        Ok(AuthTokens {
            access_token,
            refresh_token,
            expires_in: self.access_token_duration.as_secs() as i64,
            token_type: "Bearer".to_string(),
            user,
        })
    }

    /// Refresh access token using refresh token
    pub async fn refresh(&self, req: RefreshRequest) -> VibeResult<AuthTokens> {
        // Find session by refresh token
        let rows = self.store.query(
            "SELECT user_id, expires_at FROM vibe_sessions WHERE refresh_token = ?".to_string(),
            vec![SqlValue::Text(req.refresh_token.clone())],
        ).await?;

        if rows.is_empty() {
            return Err(VibeError::Unauthorized("Invalid refresh token".to_string()));
        }

        let row = &rows[0];
        let user_id = row
            .iter()
            .find(|(k, _)| k == "user_id")
            .and_then(|(_, v)| v.as_i64())
            .ok_or_else(|| VibeError::Internal(anyhow::anyhow!("Missing user_id")))?;

        // Delete old session
        self.store.execute(
            "DELETE FROM vibe_sessions WHERE refresh_token = ?".to_string(),
            vec![SqlValue::Text(req.refresh_token)],
        ).await?;

        // Get user and create new session
        let user = self.get_user_by_id(user_id).await?;
        self.create_session(user).await
    }

    /// Logout - invalidate refresh token
    pub async fn logout(&self, refresh_token: &str) -> VibeResult<()> {
        self.store.execute(
            "DELETE FROM vibe_sessions WHERE refresh_token = ?".to_string(),
            vec![SqlValue::Text(refresh_token.to_string())],
        ).await?;
        Ok(())
    }

    /// Get user by ID
    pub async fn get_user_by_id(&self, id: i64) -> VibeResult<User> {
        let rows = self.store.query(
            "SELECT id, email, metadata, created_at, updated_at FROM vibe_users WHERE id = ?"
                .to_string(),
            vec![SqlValue::Integer(id)],
        ).await?;

        if rows.is_empty() {
            return Err(VibeError::NotFound("User not found".to_string()));
        }

        self.row_to_user(&rows[0])
    }

    /// Update user metadata
    pub async fn update_user(&self, user_id: i64, req: UpdateUserRequest) -> VibeResult<User> {
        if let Some(metadata) = req.metadata {
            self.store.execute(
                "UPDATE vibe_users SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
                    .to_string(),
                vec![SqlValue::Text(metadata.to_string()), SqlValue::Integer(user_id)],
            ).await?;
        }

        self.get_user_by_id(user_id).await
    }

    /// Convert database row to User struct
    fn row_to_user(&self, row: &[(String, Value)]) -> VibeResult<User> {
        let get_str = |key: &str| -> VibeResult<String> {
            row.iter()
                .find(|(k, _)| k == key)
                .and_then(|(_, v)| v.as_str().map(String::from))
                .ok_or_else(|| VibeError::Internal(anyhow::anyhow!("Missing field: {}", key)))
        };

        let get_i64 = |key: &str| -> VibeResult<i64> {
            row.iter()
                .find(|(k, _)| k == key)
                .and_then(|(_, v)| v.as_i64())
                .ok_or_else(|| VibeError::Internal(anyhow::anyhow!("Missing field: {}", key)))
        };

        let metadata_str = get_str("metadata").unwrap_or_else(|_| "{}".to_string());
        let metadata: Value = serde_json::from_str(&metadata_str).unwrap_or(json!({}));

        Ok(User {
            id: get_i64("id")?,
            email: get_str("email")?,
            created_at: get_str("created_at")?,
            updated_at: get_str("updated_at")?,
            metadata,
        })
    }
}

// ============================================================================
// Auth Middleware Extractor
// ============================================================================

/// App state that includes AuthService
#[derive(Clone)]
pub struct AuthState {
    pub auth: AuthService,
}

/// Extract and validate JWT token from Authorization header
fn extract_auth_user(auth_state: &AuthState, headers: &axum::http::HeaderMap) -> Result<AuthUser, VibeError> {
    let auth_header = headers
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| VibeError::Unauthorized("Missing authorization header".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| VibeError::Unauthorized("Invalid authorization format".to_string()))?;

    let claims = auth_state.auth.validate_token(token)?;

    Ok(AuthUser {
        id: claims.sub,
        email: claims.email,
    })
}

// ============================================================================
// API Handlers
// ============================================================================

/// POST /v1/auth/signup
async fn signup_handler(
    State(state): State<AuthState>,
    Json(req): Json<SignupRequest>,
) -> Result<impl IntoResponse, VibeError> {
    let tokens = state.auth.signup(req).await?;
    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "data": tokens
    }))))
}

/// POST /v1/auth/login
async fn login_handler(
    State(state): State<AuthState>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, VibeError> {
    let tokens = state.auth.login(req).await?;
    Ok(Json(json!({
        "success": true,
        "data": tokens
    })))
}

/// POST /v1/auth/refresh
async fn refresh_handler(
    State(state): State<AuthState>,
    Json(req): Json<RefreshRequest>,
) -> Result<impl IntoResponse, VibeError> {
    let tokens = state.auth.refresh(req).await?;
    Ok(Json(json!({
        "success": true,
        "data": tokens
    })))
}

/// POST /v1/auth/logout
async fn logout_handler(
    State(state): State<AuthState>,
    Json(req): Json<RefreshRequest>,
) -> Result<impl IntoResponse, VibeError> {
    state.auth.logout(&req.refresh_token).await?;
    Ok(Json(json!({
        "success": true,
        "message": "Logged out successfully"
    })))
}

/// GET /v1/auth/me
async fn me_handler(
    State(state): State<AuthState>,
    headers: axum::http::HeaderMap,
) -> Result<impl IntoResponse, VibeError> {
    let auth_user = extract_auth_user(&state, &headers)?;
    let user = state.auth.get_user_by_id(auth_user.id).await?;
    Ok(Json(json!({
        "success": true,
        "data": user
    })))
}

/// PUT /v1/auth/user
async fn update_user_handler(
    State(state): State<AuthState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<UpdateUserRequest>,
) -> Result<impl IntoResponse, VibeError> {
    let auth_user = extract_auth_user(&state, &headers)?;
    let user = state.auth.update_user(auth_user.id, req).await?;
    Ok(Json(json!({
        "success": true,
        "data": user
    })))
}

// ============================================================================
// Router
// ============================================================================

/// Creates the auth router with all authentication endpoints
pub fn create_auth_router(auth_state: AuthState) -> Router {
    Router::new()
        .route("/signup", post(signup_handler))
        .route("/login", post(login_handler))
        .route("/refresh", post(refresh_handler))
        .route("/logout", post(logout_handler))
        .route("/me", get(me_handler))
        .route("/user", put(update_user_handler))
        .with_state(auth_state)
}

// ============================================================================
// Additional Error Types
// ============================================================================

impl VibeError {
    /// Create an unauthorized error
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        VibeError::Unauthorized(msg.into())
    }

    /// Create a conflict error
    pub fn conflict(msg: impl Into<String>) -> Self {
        VibeError::Conflict(msg.into())
    }

    /// Create a not found error  
    pub fn not_found(msg: impl Into<String>) -> Self {
        VibeError::NotFound(msg.into())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_service() -> AuthService {
        let store = Arc::new(VibeStore::in_memory().await.unwrap());
        let secret = AuthService::generate_secret();
        AuthService::new(store, secret).await.unwrap()
    }

    #[tokio::test]
    async fn test_password_hashing() {
        let service = create_test_service().await;
        let password = "supersecret123";
        
        let hash = service.hash_password(password).unwrap();
        assert!(service.verify_password(password, &hash).unwrap());
        assert!(!service.verify_password("wrongpassword", &hash).unwrap());
    }

    #[tokio::test]
    async fn test_signup_flow() {
        let service = create_test_service().await;
        
        let tokens = service.signup(SignupRequest {
            email: "test@vibedb.dev".to_string(),
            password: "password123".to_string(),
            metadata: None,
        }).await.unwrap();

        assert!(!tokens.access_token.is_empty());
        assert!(!tokens.refresh_token.is_empty());
        assert_eq!(tokens.user.email, "test@vibedb.dev");
    }

    #[tokio::test]
    async fn test_login_flow() {
        let service = create_test_service().await;
        
        // First signup
        service.signup(SignupRequest {
            email: "test@vibedb.dev".to_string(),
            password: "password123".to_string(),
            metadata: None,
        }).await.unwrap();

        // Then login
        let tokens = service.login(LoginRequest {
            email: "test@vibedb.dev".to_string(),
            password: "password123".to_string(),
        }).await.unwrap();

        assert!(!tokens.access_token.is_empty());
    }

    #[tokio::test]
    async fn test_token_validation() {
        let service = create_test_service().await;
        
        let tokens = service.signup(SignupRequest {
            email: "test@vibedb.dev".to_string(),
            password: "password123".to_string(),
            metadata: None,
        }).await.unwrap();

        let claims = service.validate_token(&tokens.access_token).unwrap();
        assert_eq!(claims.email, "test@vibedb.dev");
    }

    #[tokio::test]
    async fn test_refresh_flow() {
        let service = create_test_service().await;
        
        let tokens = service.signup(SignupRequest {
            email: "test@vibedb.dev".to_string(),
            password: "password123".to_string(),
            metadata: None,
        }).await.unwrap();

        // Wait for 1 second to ensure new token has different timestamp (iat is in seconds)
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let new_tokens = service.refresh(RefreshRequest {
            refresh_token: tokens.refresh_token,
        }).await.unwrap();

        assert!(!new_tokens.access_token.is_empty());
        assert_ne!(new_tokens.access_token, tokens.access_token);
    }

    #[tokio::test]
    async fn test_invalid_email() {
        let service = create_test_service().await;
        
        let result = service.signup(SignupRequest {
            email: "invalid".to_string(),
            password: "password123".to_string(),
            metadata: None,
        }).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_short_password() {
        let service = create_test_service().await;
        
        let result = service.signup(SignupRequest {
            email: "test@vibedb.dev".to_string(),
            password: "short".to_string(),
            metadata: None,
        }).await;

        assert!(result.is_err());
    }
}
