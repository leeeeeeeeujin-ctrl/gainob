require("dotenv").config();

const { query } = require("../src/db");

const statements = [
  `
    create extension if not exists pgcrypto;
  `,
  `
    create table if not exists app_users (
      id uuid primary key default gen_random_uuid(),
      username text not null unique,
      password_hash text not null,
      display_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists user_profiles (
      user_id uuid primary key references app_users(id) on delete cascade,
      style text,
      risk_rule text,
      watch_items text,
      ai_provider text,
      openai_api_key text,
      openai_model text,
      gemini_api_key text,
      gemini_model text,
      updated_at timestamptz not null default now()
    );
  `,
  `
    alter table user_profiles
    add column if not exists ai_provider text;
  `,
  `
    alter table user_profiles
    add column if not exists openai_api_key text;
  `,
  `
    alter table user_profiles
    add column if not exists openai_model text;
  `,
  `
    alter table user_profiles
    add column if not exists gemini_api_key text;
  `,
  `
    alter table user_profiles
    add column if not exists gemini_model text;
  `,
  `
    create table if not exists journal_entries (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references app_users(id) on delete cascade,
      symbol text,
      note text,
      focus_question text,
      created_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists app_sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references app_users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
  `,
  `
    create index if not exists journal_entries_user_id_created_at_idx
    on journal_entries(user_id, created_at desc);
  `,
  `
    create index if not exists app_sessions_user_id_idx
    on app_sessions(user_id);
  `
];

async function main() {
  for (const statement of statements) {
    await query(statement);
  }

  console.log("Database schema initialized.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
