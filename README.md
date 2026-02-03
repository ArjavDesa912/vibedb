# 🛸 VibeDB

**A high-performance, "Schema-Later" database with automatic schema evolution.**

VibeDB treats incoming JSON as the "Source of Truth" and dynamically mutates its underlying relational schema to fit your data. No migrations needed - just push your data!

## ✨ Features

- **Schema-Later Architecture**: No need to define schemas upfront. Push any JSON and VibeDB automatically creates and evolves the schema.
- **Automatic Type Inference**: JSON types are intelligently mapped to SQLite types.
- **WAL Mode**: Uses SQLite's Write-Ahead Logging for high-concurrency writes.
- **Real-time Streaming**: SSE endpoints for live data updates.
- **Embedded Dashboard**: Beautiful Vibe-Explorer UI bundled in the binary.
- **Zero Configuration**: Just run the binary and start pushing data.

## 🚀 Quick Start

### Run the Server

```bash
# Build and run
cargo run --release

# Or with custom options
cargo run --release -- --port 8080 --db mydata.db

# In-memory mode (for testing)
cargo run --release -- --memory
```

### Push Data

```bash
# Create a user (auto-creates 'users' collection and schema)
curl -X POST http://localhost:3000/v1/push/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@vibe.db", "age": 28}'

# Add a new field - schema auto-evolves!
curl -X POST http://localhost:3000/v1/push/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob", "email": "bob@vibe.db", "department": "Engineering"}'
```

### Query Data

```bash
# Get all users
curl http://localhost:3000/v1/query/users

# With filters
curl "http://localhost:3000/v1/query/users?department=Engineering"

# With pagination
curl "http://localhost:3000/v1/query/users?limit=10&offset=0&order_by=created_at&order_dir=DESC"

# Get by ID
curl http://localhost:3000/v1/query/users/1
```

### Batch Operations

```bash
# Insert multiple documents
curl -X POST http://localhost:3000/v1/push/products/batch \
  -H "Content-Type: application/json" \
  -d '[
    {"name": "Widget", "price": 9.99},
    {"name": "Gadget", "price": 19.99},
    {"name": "Gizmo", "price": 29.99}
  ]'
```

### Update & Delete

```bash
# Update a document
curl -X POST http://localhost:3000/v1/update/users/1 \
  -H "Content-Type: application/json" \
  -d '{"department": "Leadership"}'

# Delete a document
curl -X POST http://localhost:3000/v1/delete/users/1
```

### Explore Your Data

Open in browser: **http://localhost:3000/explore**

## 📊 API Endpoints

### Core Data Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/push/:collection` | Insert a document |
| `POST` | `/v1/push/:collection/batch` | Batch insert |
| `GET` | `/v1/query/:collection` | Query documents with filters |
| `GET` | `/v1/query/:collection/:id` | Get document by ID |
| `POST` | `/v1/update/:collection/:id` | Update a document |
| `POST` | `/v1/delete/:collection/:id` | Delete a document |
| `GET` | `/v1/tables` | List all collections |
| `GET` | `/v1/tables/:collection` | Get collection stats |
| `GET` | `/v1/stream/:collection` | SSE stream for real-time updates |
| `GET` | `/explore` | Vibe-Explorer dashboard |
| `GET` | `/health` | Health check |

### 🔐 Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/v1/auth/signup` | Register new user | No |
| `POST` | `/v1/auth/login` | Get JWT tokens | No |
| `POST` | `/v1/auth/refresh` | Refresh access token | No |
| `POST` | `/v1/auth/logout` | Invalidate refresh token | Yes |
| `GET` | `/v1/auth/me` | Get current user | Yes |
| `PUT` | `/v1/auth/user` | Update user metadata | Yes |

### 📁 File Storage

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/v1/storage/buckets` | Create bucket | Yes |
| `GET` | `/v1/storage/buckets` | List buckets | Yes |
| `DELETE` | `/v1/storage/buckets/:name` | Delete bucket | Yes |
| `POST` | `/v1/storage/object/:bucket/*path` | Upload file | Yes* |
| `GET` | `/v1/storage/object/:bucket/*path` | Download file | Yes* |
| `DELETE` | `/v1/storage/object/:bucket/*path` | Delete file | Yes |
| `GET` | `/v1/storage/list/:bucket` | List files | Yes* |

*Public buckets allow unauthenticated read access

## 🔧 Configuration

### Command Line Options

```
OPTIONS:
    -d, --db <PATH>      Database file path [default: vibedb.db]
    -p, --port <PORT>    Server port [default: 3000]
    -h, --host <HOST>    Host to bind [default: 0.0.0.0]
    -m, --memory         Use in-memory database
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VIBEDB_PORT` | Server port |
| `VIBEDB_PATH` | Database file path |
| `VIBEDB_HOST` | Host to bind to |
| `VIBEDB_MEMORY` | Set to use in-memory database |
| `VIBEDB_JWT_SECRET` | JWT signing secret (auto-generated if not set) |
| `VIBEDB_STORAGE_PATH` | File storage directory [default: ./vibe_storage/] |

## 🛡️ Type Mapping

| JSON Type | SQLite Affinity | Notes |
|-----------|-----------------|-------|
| `number` (integer) | `INTEGER` | When `is_i64()` is true |
| `number` (float) | `REAL` | Default for decimals |
| `boolean` | `INTEGER` | Stored as 1 or 0 |
| `string` | `TEXT` | UTF-8 encoded |
| `object` / `array` | `TEXT` | Serialized as JSON string |
| `null` | `NULL` | Ignored during column creation |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         🛸 VibeDB                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Vibe-API    │  │ Schema-Brain │  │ Migration-Automaton     │ │
│  │ (Axum)      │──│ (Inference)  │──│ (Guard)                 │ │
│  │             │  │              │  │                         │ │
│  │ HTTP/SSE    │  │ JSON → SQL   │  │ ALTER TABLE             │ │
│  │ endpoints   │  │ type mapping │  │ transactions            │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│         │                                      │                 │
│         │         ┌──────────────────┐         │                 │
│         └─────────│  DashMap Cache   │─────────┘                 │
│                   │  (Schema Cache)  │                           │
│                   └────────┬─────────┘                           │
│                            │                                     │
│                   ┌────────▼─────────┐                           │
│                   │   Vibe-Store     │                           │
│                   │   (libSQL/WAL)   │                           │
│                   └──────────────────┘                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Vibe-Explorer                          │   │
│  │              (Embedded WASM Dashboard)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔒 Security Features

- **SQL Identifier Validation**: All table and column names are validated against a strict regex pattern.
- **Reserved Keyword Protection**: SQL reserved keywords cannot be used as identifiers.
- **Parameter Binding**: All values use `?` placeholders to prevent SQL injection.
- **Column Limit**: Tables are capped at 1,000 columns to prevent schema bloat attacks.

## 📈 Performance

- **WAL Mode**: Enables concurrent reads during writes.
- **DashMap Caching**: Schema information is cached in memory to minimize disk reads.
- **Connection Pooling**: Single connection with RwLock for safe concurrent access.
- **Batch Operations**: Efficient bulk inserts with transaction support.

## 🧪 Testing

```bash
# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ using Rust, libSQL, and Axum**
