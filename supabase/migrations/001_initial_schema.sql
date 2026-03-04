-- Quanto Custa? - Database Schema
-- GoodRx for Brazil via WhatsApp

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS unaccent; -- For accent-insensitive search

-- ============================================================
-- ANVISA PMC Medications (~60K+ rows)
-- ============================================================
CREATE TABLE medications (
    id BIGSERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    active_ingredient TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    presentation TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('reference', 'generic', 'similar', 'biological', 'new', 'specific', 'phytotherapic')),
    therapeutic_class TEXT,
    -- Preco Fabrica (factory price)
    pf_sem_impostos NUMERIC(10,2),
    pf_icms_0 NUMERIC(10,2),
    -- Preco Maximo ao Consumidor by ICMS bracket
    pmc_icms_0 NUMERIC(10,2),
    pmc_icms_12 NUMERIC(10,2),
    pmc_icms_17 NUMERIC(10,2),
    pmc_icms_18 NUMERIC(10,2),
    pmc_icms_19 NUMERIC(10,2),
    pmc_icms_20 NUMERIC(10,2),
    -- Farmacia Popular
    farmacia_popular_eligible BOOLEAN DEFAULT FALSE,
    farmacia_popular_free BOOLEAN DEFAULT FALSE,
    -- Identifiers
    ean_code TEXT,
    anvisa_registry TEXT,
    -- Metadata
    restriction TEXT, -- Tarja: vermelha, preta, sem tarja
    hospital_use_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast search
CREATE INDEX idx_medications_product_name_trgm ON medications USING GIN (product_name gin_trgm_ops);
CREATE INDEX idx_medications_active_ingredient_trgm ON medications USING GIN (active_ingredient gin_trgm_ops);
CREATE INDEX idx_medications_active_ingredient ON medications (active_ingredient);
CREATE INDEX idx_medications_category ON medications (category);
CREATE INDEX idx_medications_ean ON medications (ean_code) WHERE ean_code IS NOT NULL;
CREATE INDEX idx_medications_farmacia_popular ON medications (farmacia_popular_eligible) WHERE farmacia_popular_eligible = TRUE;

-- ============================================================
-- Drug Equivalents (Brand -> Generic mappings)
-- ============================================================
CREATE TABLE drug_equivalents (
    id BIGSERIAL PRIMARY KEY,
    reference_medication_id BIGINT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    equivalent_medication_id BIGINT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    equivalent_type TEXT NOT NULL CHECK (equivalent_type IN ('generic', 'similar_intercambiavel')),
    active_ingredient TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (reference_medication_id, equivalent_medication_id)
);

CREATE INDEX idx_drug_equivalents_reference ON drug_equivalents (reference_medication_id);
CREATE INDEX idx_drug_equivalents_equivalent ON drug_equivalents (equivalent_medication_id);
CREATE INDEX idx_drug_equivalents_ingredient ON drug_equivalents (active_ingredient);

-- ============================================================
-- Farmacia Popular Locations
-- ============================================================
CREATE TABLE farmacia_popular_locations (
    id BIGSERIAL PRIMARY KEY,
    cnes_code TEXT UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT NOT NULL,
    state CHAR(2) NOT NULL,
    zipcode TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    phone TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fp_locations_state ON farmacia_popular_locations (state);
CREATE INDEX idx_fp_locations_city ON farmacia_popular_locations (city);

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number TEXT UNIQUE NOT NULL,
    name TEXT,
    state CHAR(2), -- For ICMS-based pricing
    city TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMPTZ,
    daily_lookups_used INT DEFAULT 0,
    daily_lookups_reset_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_whatsapp ON users (whatsapp_number);

-- ============================================================
-- User Saved Medications ("Minha Farmacia")
-- ============================================================
CREATE TABLE user_medications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_id BIGINT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    nickname TEXT, -- User's custom name for this med
    dosage_schedule TEXT, -- e.g. "2x ao dia"
    refill_reminder_days INT, -- Days before running out to remind
    next_refill_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, medication_id)
);

CREATE INDEX idx_user_medications_user ON user_medications (user_id);

-- ============================================================
-- Search Logs (Analytics)
-- ============================================================
CREATE TABLE search_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_type TEXT NOT NULL CHECK (query_type IN ('text', 'image')),
    query_text TEXT, -- For text searches
    image_url TEXT, -- For image searches (Supabase Storage URL)
    medications_found JSONB, -- Array of matched medication IDs
    response_time_ms INT,
    vision_model_used TEXT, -- claude, gpt4o, null for text
    vision_confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user ON search_logs (user_id);
CREATE INDEX idx_search_logs_created ON search_logs (created_at DESC);

-- ============================================================
-- Affiliate Clicks & Conversions
-- ============================================================
CREATE TABLE affiliate_clicks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    medication_id BIGINT REFERENCES medications(id) ON DELETE SET NULL,
    pharmacy TEXT NOT NULL, -- drogasil, droga_raia, pague_menos
    affiliate_link TEXT NOT NULL,
    click_id TEXT UNIQUE, -- Awin click ID
    converted BOOLEAN DEFAULT FALSE,
    commission_amount NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_affiliate_clicks_user ON affiliate_clicks (user_id);
CREATE INDEX idx_affiliate_clicks_pharmacy ON affiliate_clicks (pharmacy);
CREATE INDEX idx_affiliate_clicks_created ON affiliate_clicks (created_at DESC);

-- ============================================================
-- Subscriptions
-- ============================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'premium', -- premium, family
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'expired')),
    payment_provider TEXT NOT NULL, -- asaas, openpix
    external_subscription_id TEXT,
    amount_brl NUMERIC(10,2) NOT NULL DEFAULT 9.90,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);

-- ============================================================
-- Family Members (Premium feature)
-- ============================================================
CREATE TABLE family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    whatsapp_number TEXT, -- Optional, may not have WhatsApp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_family_members_owner ON family_members (owner_user_id);

-- ============================================================
-- Price Alerts (Premium feature)
-- ============================================================
CREATE TABLE price_alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medication_id BIGINT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    target_price NUMERIC(10,2), -- Alert when price drops below this
    last_notified_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_alerts_active ON price_alerts (user_id, active) WHERE active = TRUE;

-- ============================================================
-- Helper functions
-- ============================================================

-- Get PMC price for a user's state
CREATE OR REPLACE FUNCTION get_pmc_for_state(med medications, user_state CHAR(2))
RETURNS NUMERIC(10,2) AS $$
BEGIN
    -- ICMS brackets by state (simplified - major states)
    CASE user_state
        -- ICMS 0% states (Zona Franca de Manaus)
        WHEN 'AM', 'AP', 'RR' THEN RETURN med.pmc_icms_0;
        -- ICMS 12%
        WHEN 'MG', 'PR', 'SC', 'RS', 'RJ' THEN RETURN med.pmc_icms_12;
        -- ICMS 17%
        WHEN 'AC', 'AL', 'CE', 'ES', 'MA', 'MT', 'MS', 'PA', 'PB',
             'PE', 'PI', 'RN', 'RO', 'SE', 'TO', 'DF', 'GO' THEN RETURN med.pmc_icms_17;
        -- ICMS 18%
        WHEN 'SP' THEN RETURN med.pmc_icms_18;
        -- ICMS 19%
        WHEN 'BA' THEN RETURN med.pmc_icms_19;
        -- ICMS 20%
        WHEN 'RJ' THEN RETURN med.pmc_icms_20;
        -- Default to highest (most conservative)
        ELSE RETURN med.pmc_icms_20;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Full-text search function with accent/case insensitive matching
CREATE OR REPLACE FUNCTION search_medications(search_term TEXT, result_limit INT DEFAULT 20)
RETURNS TABLE (
    medication_id BIGINT,
    product_name TEXT,
    active_ingredient TEXT,
    manufacturer TEXT,
    presentation TEXT,
    category TEXT,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.product_name,
        m.active_ingredient,
        m.manufacturer,
        m.presentation,
        m.category,
        GREATEST(
            similarity(unaccent(lower(m.product_name)), unaccent(lower(search_term))),
            similarity(unaccent(lower(m.active_ingredient)), unaccent(lower(search_term)))
        ) AS similarity_score
    FROM medications m
    WHERE
        unaccent(lower(m.product_name)) % unaccent(lower(search_term))
        OR unaccent(lower(m.active_ingredient)) % unaccent(lower(search_term))
        OR unaccent(lower(m.product_name)) ILIKE '%' || unaccent(lower(search_term)) || '%'
        OR unaccent(lower(m.active_ingredient)) ILIKE '%' || unaccent(lower(search_term)) || '%'
    ORDER BY similarity_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (backend)
CREATE POLICY "Service role full access" ON users FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access" ON user_medications FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access" ON family_members FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access" ON price_alerts FOR ALL USING (TRUE) WITH CHECK (TRUE);
