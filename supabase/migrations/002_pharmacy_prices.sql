-- Pharmacy Prices Cache (on-demand scraping with 24h TTL)
CREATE TABLE IF NOT EXISTS pharmacy_prices (
    id BIGSERIAL PRIMARY KEY,
    search_query TEXT NOT NULL,
    pharmacy TEXT NOT NULL,
    results JSONB NOT NULL DEFAULT '[]',
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (search_query, pharmacy)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_query ON pharmacy_prices (search_query);
