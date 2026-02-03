//! # 🛸 VibeDB
//!
//! A high-performance, "Schema-Later" database that dynamically evolves
//! its schema based on incoming JSON payloads.
//!
//! ## Quick Start
//!
//! ```bash
//! # Run with default settings (data.db, port 3000)
//! vibedb
//!
//! # Custom database and port
//! vibedb --db mydata.db --port 8080
//!
//! # In-memory mode (for testing)
//! vibedb --memory
//! ```
//!
//! ## API Usage
//!
//! ```bash
//! # Push data (auto-creates collection and schema)
//! curl -X POST http://localhost:3000/v1/push/users \
//!   -H "Content-Type: application/json" \
//!   -d '{"name": "Alice", "email": "alice@vibe.db"}'
//!
//! # Query data
//! curl http://localhost:3000/v1/query/users
//!
//! # Open Explorer dashboard
//! open http://localhost:3000/explore
//! ```

use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use vibedb::api::{create_router, AppState};
use vibedb::auth::{AuthService, AuthState, create_auth_router};
use vibedb::db::VibeStore;
use vibedb::explorer::create_explorer_router;
use vibedb::storage::{StorageService, StorageState, create_storage_router};

/// CLI arguments
struct Args {
    /// Database file path
    db_path: String,
    /// Server port
    port: u16,
    /// Use in-memory database
    in_memory: bool,
    /// Host to bind to
    host: String,
    /// JWT secret for authentication
    jwt_secret: Option<String>,
    /// Storage path for file storage
    storage_path: Option<String>,
}

impl Default for Args {
    fn default() -> Self {
        Self {
            db_path: "vibedb.db".to_string(),
            port: 3000,
            in_memory: false,
            host: "0.0.0.0".to_string(),
            jwt_secret: None,
            storage_path: None,
        }
    }
}

impl Args {
    fn from_env() -> Self {
        let mut args = Args::default();
        let env_args: Vec<String> = env::args().collect();
        let mut i = 1;

        while i < env_args.len() {
            match env_args[i].as_str() {
                "--db" | "-d" => {
                    if i + 1 < env_args.len() {
                        args.db_path = env_args[i + 1].clone();
                        i += 1;
                    }
                }
                "--port" | "-p" => {
                    if i + 1 < env_args.len() {
                        args.port = env_args[i + 1].parse().unwrap_or(3000);
                        i += 1;
                    }
                }
                "--host" | "-h" => {
                    if i + 1 < env_args.len() {
                        args.host = env_args[i + 1].clone();
                        i += 1;
                    }
                }
                "--memory" | "-m" => {
                    args.in_memory = true;
                }
                "--help" => {
                    print_help();
                    std::process::exit(0);
                }
                _ => {}
            }
            i += 1;
        }

        // Environment variable overrides
        if let Ok(port) = env::var("VIBEDB_PORT") {
            args.port = port.parse().unwrap_or(args.port);
        }
        if let Ok(db) = env::var("VIBEDB_PATH") {
            args.db_path = db;
        }
        if let Ok(host) = env::var("VIBEDB_HOST") {
            args.host = host;
        }
        if env::var("VIBEDB_MEMORY").is_ok() {
            args.in_memory = true;
        }
        if let Ok(secret) = env::var("VIBEDB_JWT_SECRET") {
            args.jwt_secret = Some(secret);
        }
        if let Ok(storage) = env::var("VIBEDB_STORAGE_PATH") {
            args.storage_path = Some(storage);
        }

        args
    }
}

fn print_help() {
    println!(
        r#"
🛸 VibeDB - Schema-Later Database

USAGE:
    vibedb [OPTIONS]

OPTIONS:
    -d, --db <PATH>      Database file path [default: vibedb.db]
    -p, --port <PORT>    Server port [default: 3000]
    -h, --host <HOST>    Host to bind to [default: 0.0.0.0]
    -m, --memory         Use in-memory database
        --help           Print this help message

ENVIRONMENT VARIABLES:
    VIBEDB_PORT          Server port
    VIBEDB_PATH          Database file path
    VIBEDB_HOST          Host to bind to
    VIBEDB_MEMORY        Set to use in-memory database

EXAMPLES:
    # Start with default settings
    vibedb

    # Custom database and port
    vibedb --db mydata.db --port 8080

    # In-memory mode for testing
    vibedb --memory

API ENDPOINTS:
    POST /v1/push/:collection       Insert data (auto-creates schema)
    POST /v1/push/:collection/batch Batch insert
    GET  /v1/query/:collection      Query data with filters
    GET  /v1/query/:collection/:id  Get by ID
    POST /v1/update/:collection/:id Update document
    POST /v1/delete/:collection/:id Delete document
    GET  /v1/tables                 List all tables
    GET  /v1/tables/:collection     Get table stats
    GET  /v1/stream/:collection     SSE stream for real-time updates
    GET  /explore                   Vibe-Explorer dashboard
    GET  /health                    Health check
"#
    );
}

fn print_banner(port: u16, in_memory: bool, db_path: &str) {
    println!(
        r#"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🛸  ██╗   ██╗██╗██████╗ ███████╗██████╗ ██████╗               ║
║       ██║   ██║██║██╔══██╗██╔════╝██╔══██╗██╔══██╗              ║
║       ██║   ██║██║██████╔╝█████╗  ██║  ██║██████╔╝              ║
║       ╚██╗ ██╔╝██║██╔══██╗██╔══╝  ██║  ██║██╔══██╗              ║
║        ╚████╔╝ ██║██████╔╝███████╗██████╔╝██████╔╝              ║
║         ╚═══╝  ╚═╝╚═════╝ ╚══════╝╚═════╝ ╚═════╝               ║
║                                                                  ║
║   Schema-Later Database with Automatic Evolution                 ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║   🌐 API:      http://localhost:{:<5}                           ║
║   📊 Explorer: http://localhost:{:<5}/explore                   ║
║   💾 Database: {:<46} ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
"#,
        port,
        port,
        if in_memory { ":memory:" } else { db_path }
    );
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .compact()
        .init();

    // Parse arguments
    let args = Args::from_env();

    // Initialize database
    let store = if args.in_memory {
        info!("🧪 Using in-memory database");
        Arc::new(VibeStore::in_memory().await?)
    } else {
        info!("💾 Using database file: {}", args.db_path);
        Arc::new(VibeStore::new(&args.db_path).await?)
    };

    // Initialize JWT secret (use provided or generate new)
    let jwt_secret = args
        .jwt_secret
        .map(|s| s.into_bytes())
        .unwrap_or_else(|| {
            info!("🔑 Generating random JWT secret (set VIBEDB_JWT_SECRET for persistence)");
            AuthService::generate_secret()
        });

    // Initialize Auth Service
    let auth_service = AuthService::new(Arc::clone(&store), jwt_secret).await?;
    let auth_state = AuthState { auth: auth_service };

    // Initialize Storage Service
    let storage_path = args.storage_path.map(PathBuf::from);
    let storage_service = StorageService::new(Arc::clone(&store), storage_path).await?;
    let storage_state = StorageState { storage: storage_service };

    // Create application state
    let state = AppState::new(Arc::clone(&store));

    // Build router with API, Auth, Storage, and Explorer
    let app = create_router(state)
        .nest("/v1/auth", create_auth_router(auth_state))
        .nest("/v1/storage", create_storage_router(storage_state))
        .merge(create_explorer_router());

    // Print banner
    print_banner(args.port, args.in_memory, &args.db_path);

    // Start server
    let addr: SocketAddr = format!("{}:{}", args.host, args.port)
        .parse()
        .expect("Invalid address");

    info!("🚀 VibeDB listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c()
                .await
                .expect("failed to install CTRL+C signal handler");
        })
        .await?;

    Ok(())
}
