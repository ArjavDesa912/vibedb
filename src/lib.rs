//! # 🛸 VibeDB
//!
//! A high-performance, "Schema-Later" database that dynamically evolves
//! its schema based on incoming JSON payloads.
//!
//! ## Core Components
//!
//! - **Vibe-Ingestor**: Handles HTTP/WebSocket traffic via Axum
//! - **Schema-Brain (Inference)**: Inspects JSON and generates delta-migrations
//! - **Migration-Automaton (Guard)**: Executes ALTER TABLE statements safely
//! - **Vibe-Store**: Manages the persistent .db file with WAL mode
//! - **Vibe-Explorer**: Embedded WASM dashboard for real-time visualization

pub mod api;
pub mod db;
pub mod error;
pub mod explorer;
pub mod guard;
pub mod inference;

pub use error::{VibeError, VibeResult};
