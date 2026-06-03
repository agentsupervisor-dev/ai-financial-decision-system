-- Market universe: curated list of tickers by category
CREATE TABLE IF NOT EXISTS market_universe (
  id          BIGSERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  universe    TEXT NOT NULL,  -- 'mega10', 'nasdaq100', 'sp500'
  company_name TEXT NOT NULL,
  sector      TEXT,
  exchange    TEXT,
  sort_order  INT DEFAULT 0,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, universe)
);

ALTER TABLE market_universe ENABLE ROW LEVEL SECURITY;
-- Public read — all logged-in users can browse tickers
CREATE POLICY "Authenticated users can read market_universe"
  ON market_universe FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed: Top 10 MEGA cap US stocks
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('AAPL',  'mega10', 'Apple Inc.',            'Technology',         'NASDAQ', 1),
  ('MSFT',  'mega10', 'Microsoft Corp.',        'Technology',         'NASDAQ', 2),
  ('NVDA',  'mega10', 'NVIDIA Corp.',           'Technology',         'NASDAQ', 3),
  ('GOOGL', 'mega10', 'Alphabet Inc.',          'Communication',      'NASDAQ', 4),
  ('AMZN',  'mega10', 'Amazon.com Inc.',        'Consumer Cyclical',  'NASDAQ', 5),
  ('META',  'mega10', 'Meta Platforms Inc.',    'Communication',      'NASDAQ', 6),
  ('TSLA',  'mega10', 'Tesla Inc.',             'Automotive',         'NASDAQ', 7),
  ('AVGO',  'mega10', 'Broadcom Inc.',          'Technology',         'NASDAQ', 8),
  ('JPM',   'mega10', 'JPMorgan Chase & Co.',   'Financial Services', 'NYSE',   9),
  ('LLY',   'mega10', 'Eli Lilly and Co.',      'Healthcare',         'NYSE',   10)
ON CONFLICT (symbol, universe) DO NOTHING;
