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
    create table if not exists analysis_history (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references app_users(id) on delete cascade,
      symbol text not null,
      timeframe text,
      provider text,
      model text,
      manual_annotations jsonb not null default '[]'::jsonb,
      ai_annotations jsonb not null default '[]'::jsonb,
      snapshot jsonb,
      context jsonb,
      analysis text,
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
  `,
  `
    create index if not exists analysis_history_user_id_created_at_idx
    on analysis_history(user_id, created_at desc);
  `,
  `
    create table if not exists conversations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references app_users(id) on delete cascade,
      title text,
      symbol text,
      timeframe text,
      created_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists conversation_messages (
      id uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      sender text not null,
      content text,
      meta jsonb,
      created_at timestamptz not null default now()
    );
  `,
  `
    create index if not exists conversations_user_id_created_at_idx
    on conversations(user_id, created_at desc);
  `,
  `
    create index if not exists conversation_messages_conversation_id_created_at_idx
    on conversation_messages(conversation_id, created_at asc);
  `,
  `
    create table if not exists market_direction_history (
      id uuid primary key default gen_random_uuid(),
      symbol text not null,
      timeframe text not null,
      score numeric not null,
      trust_score numeric not null,
      tone text,
      bias text,
      price_usdt numeric,
      change_24h_pct numeric,
      orderbook_imbalance_pct numeric,
      quote_volume_24h_usdt numeric,
      snapshot jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `,
  `
    create index if not exists market_direction_history_symbol_timeframe_created_at_idx
    on market_direction_history(symbol, timeframe, created_at desc);
  `,
  `
    create index if not exists market_direction_history_timeframe_created_at_idx
    on market_direction_history(timeframe, created_at desc);
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
