import type Database from 'better-sqlite3'

type Migration = {
  id: number
  name: string
  sql: string
}

const migrations: Migration[] = [
  {
    id: 1,
    name: 'create-core-tables',
    sql: `
      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        venue TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        quote_currency TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS periods (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        market_bias TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        my_realtime_view TEXT NOT NULL,
        trade_plan_md TEXT NOT NULL,
        context_focus TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        FOREIGN KEY (period_id) REFERENCES periods(id)
      );

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        status TEXT NOT NULL,
        quantity REAL NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss REAL NOT NULL,
        take_profit REAL NOT NULL,
        exit_price REAL,
        pnl_r REAL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        thesis TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        trade_id TEXT,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        author_kind TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        content_block_ids_json TEXT NOT NULL,
        screenshot_id TEXT,
        ai_run_id TEXT,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS screenshots (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_id TEXT,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        asset_url TEXT NOT NULL,
        caption TEXT,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        screenshot_id TEXT NOT NULL,
        shape TEXT NOT NULL,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        x1 REAL NOT NULL,
        y1 REAL NOT NULL,
        x2 REAL NOT NULL,
        y2 REAL NOT NULL,
        text TEXT,
        stroke_width REAL NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (screenshot_id) REFERENCES screenshots(id)
      );

      CREATE TABLE IF NOT EXISTS content_blocks (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_id TEXT,
        block_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        context_type TEXT NOT NULL,
        context_id TEXT NOT NULL,
        soft_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS ai_runs (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL,
        prompt_kind TEXT NOT NULL,
        input_summary TEXT NOT NULL,
        finished_at TEXT,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS analysis_cards (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        ai_run_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        bias TEXT NOT NULL,
        confidence_pct REAL NOT NULL,
        reversal_probability_pct REAL NOT NULL,
        entry_zone TEXT NOT NULL,
        stop_loss TEXT NOT NULL,
        take_profit TEXT NOT NULL,
        invalidation TEXT NOT NULL,
        summary_short TEXT NOT NULL,
        deep_analysis_md TEXT NOT NULL,
        supporting_factors_json TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        session_id TEXT NOT NULL,
        trade_id TEXT NOT NULL,
        score REAL NOT NULL,
        note_md TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (trade_id) REFERENCES trades(id)
      );

      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'create-knowledge-pipeline-tables',
    sql: `
      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        source_type TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        language TEXT NOT NULL,
        content_md TEXT NOT NULL,
        checksum TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS knowledge_import_jobs (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        source_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        input_snapshot_json TEXT NOT NULL,
        output_summary TEXT NOT NULL,
        finished_at TEXT,
        deleted_at TEXT,
        FOREIGN KEY (source_id) REFERENCES knowledge_sources(id)
      );

      CREATE TABLE IF NOT EXISTS knowledge_fragments (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        source_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        sequence_no INTEGER NOT NULL,
        chapter_label TEXT,
        page_from INTEGER,
        page_to INTEGER,
        content_md TEXT NOT NULL,
        tokens_estimate INTEGER NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (source_id) REFERENCES knowledge_sources(id),
        FOREIGN KEY (job_id) REFERENCES knowledge_import_jobs(id)
      );

      CREATE TABLE IF NOT EXISTS knowledge_cards (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_id TEXT NOT NULL,
        fragment_id TEXT NOT NULL,
        card_type TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_md TEXT NOT NULL,
        trigger_conditions_md TEXT NOT NULL,
        invalidation_md TEXT NOT NULL,
        risk_rule_md TEXT NOT NULL,
        contract_scope TEXT NOT NULL,
        timeframe_scope TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        status TEXT NOT NULL,
        version INTEGER NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (source_id) REFERENCES knowledge_sources(id),
        FOREIGN KEY (fragment_id) REFERENCES knowledge_fragments(id)
      );

      CREATE TABLE IF NOT EXISTS knowledge_reviews (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        knowledge_card_id TEXT NOT NULL,
        review_action TEXT NOT NULL,
        review_note_md TEXT NOT NULL,
        reviewed_by TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        FOREIGN KEY (knowledge_card_id) REFERENCES knowledge_cards(id)
      );

      CREATE TABLE IF NOT EXISTS knowledge_groundings (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        knowledge_card_id TEXT NOT NULL,
        session_id TEXT,
        trade_id TEXT,
        screenshot_id TEXT,
        annotation_id TEXT,
        anchor_id TEXT,
        ai_run_id TEXT,
        match_reason_md TEXT NOT NULL,
        relevance_score REAL NOT NULL,
        FOREIGN KEY (knowledge_card_id) REFERENCES knowledge_cards(id)
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_cards_status ON knowledge_cards(status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_cards_scope ON knowledge_cards(contract_scope, timeframe_scope);
      CREATE INDEX IF NOT EXISTS idx_knowledge_fragments_source ON knowledge_fragments(source_id, sequence_no);
      CREATE INDEX IF NOT EXISTS idx_knowledge_reviews_card ON knowledge_reviews(knowledge_card_id, created_at);
    `,
  },
  {
    id: 3,
    name: 'create-market-anchor-tables',
    sql: `
      CREATE TABLE IF NOT EXISTS market_anchors (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        session_id TEXT,
        trade_id TEXT,
        source_annotation_id TEXT,
        source_annotation_label TEXT,
        source_screenshot_id TEXT,
        title TEXT NOT NULL,
        semantic_type TEXT,
        timeframe_scope TEXT,
        price_low REAL,
        price_high REAL,
        thesis_md TEXT NOT NULL,
        invalidation_rule_md TEXT NOT NULL,
        status TEXT NOT NULL,
        carry_forward INTEGER NOT NULL DEFAULT 1,
        deleted_at TEXT,
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (trade_id) REFERENCES trades(id),
        FOREIGN KEY (source_annotation_id) REFERENCES annotations(id),
        FOREIGN KEY (source_screenshot_id) REFERENCES screenshots(id)
      );

      CREATE TABLE IF NOT EXISTS market_anchor_status_history (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        anchor_id TEXT NOT NULL,
        previous_status TEXT,
        next_status TEXT NOT NULL,
        reason_md TEXT NOT NULL,
        changed_by TEXT,
        FOREIGN KEY (anchor_id) REFERENCES market_anchors(id)
      );

      CREATE INDEX IF NOT EXISTS idx_market_anchors_scope
      ON market_anchors(contract_id, session_id, trade_id, status, updated_at);

      CREATE INDEX IF NOT EXISTS idx_market_anchors_annotation
      ON market_anchors(source_annotation_id, deleted_at);

      CREATE INDEX IF NOT EXISTS idx_market_anchor_status_history_anchor
      ON market_anchor_status_history(anchor_id, created_at DESC);
    `,
  },
  {
    id: 4,
    name: 'add-analysis-card-trade-granularity',
    sql: `
      ALTER TABLE analysis_cards ADD COLUMN trade_id TEXT;

      UPDATE analysis_cards
      SET trade_id = (
        SELECT ev.trade_id
        FROM ai_runs ar
        LEFT JOIN events ev ON ev.id = ar.event_id
        WHERE ar.id = analysis_cards.ai_run_id
        LIMIT 1
      )
      WHERE trade_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_analysis_cards_trade_created
      ON analysis_cards(trade_id, created_at DESC);
    `,
  },
  {
    id: 5,
    name: 'create-current-context-table',
    sql: `
      CREATE TABLE IF NOT EXISTS current_context (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        trade_id TEXT,
        source_view TEXT NOT NULL,
        capture_kind TEXT NOT NULL,
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        FOREIGN KEY (period_id) REFERENCES periods(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (trade_id) REFERENCES trades(id)
      );
    `,
  },
  {
    id: 6,
    name: 'create-content-block-move-audit-table',
    sql: `
      CREATE TABLE IF NOT EXISTS content_block_move_audit (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        block_id TEXT NOT NULL,
        from_context_type TEXT NOT NULL,
        from_context_id TEXT NOT NULL,
        to_context_type TEXT NOT NULL,
        to_context_id TEXT NOT NULL,
        from_session_id TEXT NOT NULL,
        to_session_id TEXT NOT NULL,
        moved_at TEXT NOT NULL,
        FOREIGN KEY (block_id) REFERENCES content_blocks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_content_block_move_audit_block
      ON content_block_move_audit(block_id, moved_at DESC);
    `,
  },
  {
    id: 7,
    name: 'add-screenshot-derived-asset-columns',
    sql: `
      ALTER TABLE screenshots ADD COLUMN raw_file_path TEXT;
      ALTER TABLE screenshots ADD COLUMN raw_asset_url TEXT;
      ALTER TABLE screenshots ADD COLUMN annotated_file_path TEXT;
      ALTER TABLE screenshots ADD COLUMN annotated_asset_url TEXT;
      ALTER TABLE screenshots ADD COLUMN annotations_json_path TEXT;

      UPDATE screenshots
      SET
        raw_file_path = COALESCE(raw_file_path, file_path),
        raw_asset_url = COALESCE(raw_asset_url, asset_url)
      WHERE raw_file_path IS NULL OR raw_asset_url IS NULL;
    `,
  },
  {
    id: 8,
    name: 'add-ai-run-audit-columns',
    sql: `
      ALTER TABLE ai_runs ADD COLUMN prompt_preview TEXT DEFAULT '';
      ALTER TABLE ai_runs ADD COLUMN raw_response_text TEXT DEFAULT '';
      ALTER TABLE ai_runs ADD COLUMN structured_response_json TEXT DEFAULT '{}';

      UPDATE ai_runs
      SET
        prompt_preview = COALESCE(prompt_preview, ''),
        raw_response_text = COALESCE(raw_response_text, ''),
        structured_response_json = COALESCE(structured_response_json, '{}')
      WHERE prompt_preview IS NULL OR raw_response_text IS NULL OR structured_response_json IS NULL;
    `,
  },
  {
    id: 9,
    name: 'add-annotation-semantic-columns',
    sql: `
      ALTER TABLE annotations ADD COLUMN title TEXT DEFAULT '';
      ALTER TABLE annotations ADD COLUMN semantic_type TEXT;
      ALTER TABLE annotations ADD COLUMN note_md TEXT DEFAULT '';
      ALTER TABLE annotations ADD COLUMN add_to_memory INTEGER NOT NULL DEFAULT 0;

      UPDATE annotations
      SET
        title = COALESCE(NULLIF(title, ''), label),
        note_md = COALESCE(note_md, COALESCE(text, '')),
        add_to_memory = COALESCE(add_to_memory, 0)
      WHERE title IS NULL OR title = '' OR note_md IS NULL OR add_to_memory IS NULL;
    `,
  },
  {
    id: 10,
    name: 'add-screenshot-analysis-context-columns',
    sql: `
      ALTER TABLE screenshots ADD COLUMN analysis_role TEXT NOT NULL DEFAULT 'event';
      ALTER TABLE screenshots ADD COLUMN analysis_session_id TEXT;
      ALTER TABLE screenshots ADD COLUMN background_layer TEXT;
      ALTER TABLE screenshots ADD COLUMN background_label TEXT;
      ALTER TABLE screenshots ADD COLUMN background_note_md TEXT NOT NULL DEFAULT '';

      UPDATE screenshots
      SET
        analysis_role = COALESCE(analysis_role, 'event'),
        background_note_md = COALESCE(background_note_md, '')
      WHERE analysis_role IS NULL OR background_note_md IS NULL;

      CREATE INDEX IF NOT EXISTS idx_screenshots_analysis_context
      ON screenshots(analysis_session_id, analysis_role, created_at DESC);
    `,
  },
  {
    id: 11,
    name: 'create-review-case-tables',
    sql: `
      CREATE TABLE IF NOT EXISTS review_cases (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary_md TEXT NOT NULL,
        ai_summary_md TEXT NOT NULL,
        selection_mode TEXT NOT NULL,
        time_range_start TEXT,
        time_range_end TEXT,
        screenshot_ids_json TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (source_session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS review_case_events (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        review_case_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        FOREIGN KEY (review_case_id) REFERENCES review_cases(id),
        FOREIGN KEY (event_id) REFERENCES events(id)
      );

      CREATE TABLE IF NOT EXISTS review_case_snapshots (
        review_case_id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        FOREIGN KEY (review_case_id) REFERENCES review_cases(id)
      );

      CREATE INDEX IF NOT EXISTS idx_review_cases_session_updated
      ON review_cases(source_session_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_review_case_events_case_sort
      ON review_case_events(review_case_id, sort_order ASC, created_at ASC);
    `,
  },
]

export const applyMigrations = (db: Database.Database) => {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)')
  const applied = new Set<number>(
    db.prepare('SELECT id FROM migrations ORDER BY id ASC').all().map((row) => Number((row as { id: number }).id)),
  )

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue
    }

    db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString(),
      )
    })()
  }
}
