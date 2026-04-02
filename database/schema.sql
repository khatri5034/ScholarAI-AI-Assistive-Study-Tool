-- ScholarAI Database Schema (PostgreSQL)
-- Optional persistence layer for multi-user metadata and plans; RAG currently uses files + FAISS.
-- Create DB first: createdb scholarai
-- Then: psql -d scholarai -f schema.sql

-- Users (optional: for multi-user later)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) UNIQUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded documents metadata
CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  filename    VARCHAR(255) NOT NULL,
  file_path   VARCHAR(512) NOT NULL,
  file_type   VARCHAR(32),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study plans (from Planner Agent)
CREATE TABLE IF NOT EXISTS study_plans (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  subject     VARCHAR(255),
  plan_json   JSONB,
  deadline    DATE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat history (optional: for persistence)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER REFERENCES chat_sessions(id),
  role        VARCHAR(16),
  content     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
