-- Seed additional stock universes into market_universe
-- mega10 already seeded in 009_market_universe.sql

-- ── NASDAQ 100 (top 25 beyond mega10) ────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('NFLX',  'nasdaq100', 'Netflix Inc.',              'Communication',      'NASDAQ', 1),
  ('COST',  'nasdaq100', 'Costco Wholesale Corp.',    'Consumer Defensive', 'NASDAQ', 2),
  ('ADBE',  'nasdaq100', 'Adobe Inc.',                'Technology',         'NASDAQ', 3),
  ('AMD',   'nasdaq100', 'Advanced Micro Devices',    'Technology',         'NASDAQ', 4),
  ('QCOM',  'nasdaq100', 'Qualcomm Inc.',             'Technology',         'NASDAQ', 5),
  ('ORCL',  'nasdaq100', 'Oracle Corp.',              'Technology',         'NASDAQ', 6),
  ('INTU',  'nasdaq100', 'Intuit Inc.',               'Technology',         'NASDAQ', 7),
  ('CSCO',  'nasdaq100', 'Cisco Systems Inc.',        'Technology',         'NASDAQ', 8),
  ('AMAT',  'nasdaq100', 'Applied Materials Inc.',    'Technology',         'NASDAQ', 9),
  ('PANW',  'nasdaq100', 'Palo Alto Networks Inc.',   'Technology',         'NASDAQ', 10),
  ('MU',    'nasdaq100', 'Micron Technology Inc.',    'Technology',         'NASDAQ', 11),
  ('KLAC',  'nasdaq100', 'KLA Corp.',                 'Technology',         'NASDAQ', 12),
  ('LRCX',  'nasdaq100', 'Lam Research Corp.',        'Technology',         'NASDAQ', 13),
  ('SNPS',  'nasdaq100', 'Synopsys Inc.',             'Technology',         'NASDAQ', 14),
  ('MRVL',  'nasdaq100', 'Marvell Technology Inc.',   'Technology',         'NASDAQ', 15),
  ('ADI',   'nasdaq100', 'Analog Devices Inc.',       'Technology',         'NASDAQ', 16),
  ('MELI',  'nasdaq100', 'MercadoLibre Inc.',         'Consumer Cyclical',  'NASDAQ', 17),
  ('FTNT',  'nasdaq100', 'Fortinet Inc.',             'Technology',         'NASDAQ', 18),
  ('CDNS',  'nasdaq100', 'Cadence Design Systems',    'Technology',         'NASDAQ', 19),
  ('INTC',  'nasdaq100', 'Intel Corp.',               'Technology',         'NASDAQ', 20),
  ('ISRG',  'nasdaq100', 'Intuitive Surgical Inc.',   'Healthcare',         'NASDAQ', 21),
  ('REGN',  'nasdaq100', 'Regeneron Pharmaceuticals', 'Healthcare',         'NASDAQ', 22),
  ('VRTX',  'nasdaq100', 'Vertex Pharmaceuticals',    'Healthcare',         'NASDAQ', 23),
  ('GILD',  'nasdaq100', 'Gilead Sciences Inc.',      'Healthcare',         'NASDAQ', 24),
  ('AMGN',  'nasdaq100', 'Amgen Inc.',                'Healthcare',         'NASDAQ', 25)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── S&P 500 Top 30 (beyond mega10 + nasdaq100) ───────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('UNH',   'sp500', 'UnitedHealth Group Inc.',     'Healthcare',         'NYSE',   1),
  ('V',     'sp500', 'Visa Inc.',                   'Financial Services', 'NYSE',   2),
  ('XOM',   'sp500', 'Exxon Mobil Corp.',           'Energy',             'NYSE',   3),
  ('MA',    'sp500', 'Mastercard Inc.',              'Financial Services', 'NYSE',   4),
  ('JNJ',   'sp500', 'Johnson & Johnson',           'Healthcare',         'NYSE',   5),
  ('WMT',   'sp500', 'Walmart Inc.',                'Consumer Defensive', 'NYSE',   6),
  ('PG',    'sp500', 'Procter & Gamble Co.',        'Consumer Defensive', 'NYSE',   7),
  ('HD',    'sp500', 'Home Depot Inc.',             'Consumer Cyclical',  'NYSE',   8),
  ('ABBV',  'sp500', 'AbbVie Inc.',                 'Healthcare',         'NYSE',   9),
  ('BAC',   'sp500', 'Bank of America Corp.',       'Financial Services', 'NYSE',   10),
  ('CVX',   'sp500', 'Chevron Corp.',               'Energy',             'NYSE',   11),
  ('MRK',   'sp500', 'Merck & Co. Inc.',            'Healthcare',         'NYSE',   12),
  ('KO',    'sp500', 'Coca-Cola Co.',               'Consumer Defensive', 'NYSE',   13),
  ('PEP',   'sp500', 'PepsiCo Inc.',                'Consumer Defensive', 'NASDAQ', 14),
  ('ACN',   'sp500', 'Accenture PLC',               'Technology',         'NYSE',   15),
  ('TMO',   'sp500', 'Thermo Fisher Scientific',    'Healthcare',         'NYSE',   16),
  ('WFC',   'sp500', 'Wells Fargo & Co.',           'Financial Services', 'NYSE',   17),
  ('MCD',   'sp500', 'McDonald''s Corp.',           'Consumer Cyclical',  'NYSE',   18),
  ('CRM',   'sp500', 'Salesforce Inc.',             'Technology',         'NYSE',   19),
  ('NKE',   'sp500', 'Nike Inc.',                   'Consumer Cyclical',  'NYSE',   20),
  ('DHR',   'sp500', 'Danaher Corp.',               'Healthcare',         'NYSE',   21),
  ('TXN',   'sp500', 'Texas Instruments Inc.',      'Technology',         'NASDAQ', 22),
  ('NEE',   'sp500', 'NextEra Energy Inc.',         'Utilities',          'NYSE',   23),
  ('HON',   'sp500', 'Honeywell International',     'Industrial',         'NASDAQ', 24),
  ('UNP',   'sp500', 'Union Pacific Corp.',         'Industrial',         'NYSE',   25),
  ('BMY',   'sp500', 'Bristol-Myers Squibb Co.',    'Healthcare',         'NYSE',   26),
  ('RTX',   'sp500', 'RTX Corp.',                   'Industrial',         'NYSE',   27),
  ('GS',    'sp500', 'Goldman Sachs Group Inc.',    'Financial Services', 'NYSE',   28),
  ('SPGI',  'sp500', 'S&P Global Inc.',             'Financial Services', 'NYSE',   29),
  ('CAT',   'sp500', 'Caterpillar Inc.',            'Industrial',         'NYSE',   30)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── SECTOR: Technology ───────────────────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('AAPL',  'sector_tech', 'Apple Inc.',              'Technology', 'NASDAQ', 1),
  ('MSFT',  'sector_tech', 'Microsoft Corp.',         'Technology', 'NASDAQ', 2),
  ('NVDA',  'sector_tech', 'NVIDIA Corp.',            'Technology', 'NASDAQ', 3),
  ('GOOGL', 'sector_tech', 'Alphabet Inc.',           'Technology', 'NASDAQ', 4),
  ('META',  'sector_tech', 'Meta Platforms Inc.',     'Technology', 'NASDAQ', 5),
  ('AVGO',  'sector_tech', 'Broadcom Inc.',           'Technology', 'NASDAQ', 6),
  ('ADBE',  'sector_tech', 'Adobe Inc.',              'Technology', 'NASDAQ', 7),
  ('AMD',   'sector_tech', 'Advanced Micro Devices',  'Technology', 'NASDAQ', 8),
  ('QCOM',  'sector_tech', 'Qualcomm Inc.',           'Technology', 'NASDAQ', 9),
  ('ORCL',  'sector_tech', 'Oracle Corp.',            'Technology', 'NASDAQ', 10),
  ('INTU',  'sector_tech', 'Intuit Inc.',             'Technology', 'NASDAQ', 11),
  ('AMAT',  'sector_tech', 'Applied Materials Inc.',  'Technology', 'NASDAQ', 12),
  ('PANW',  'sector_tech', 'Palo Alto Networks',      'Technology', 'NASDAQ', 13),
  ('TXN',   'sector_tech', 'Texas Instruments',       'Technology', 'NASDAQ', 14),
  ('CRM',   'sector_tech', 'Salesforce Inc.',         'Technology', 'NYSE',   15)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── SECTOR: Healthcare ───────────────────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('LLY',   'sector_health', 'Eli Lilly and Co.',          'Healthcare', 'NYSE',   1),
  ('UNH',   'sector_health', 'UnitedHealth Group Inc.',    'Healthcare', 'NYSE',   2),
  ('JNJ',   'sector_health', 'Johnson & Johnson',          'Healthcare', 'NYSE',   3),
  ('ABBV',  'sector_health', 'AbbVie Inc.',                'Healthcare', 'NYSE',   4),
  ('MRK',   'sector_health', 'Merck & Co. Inc.',           'Healthcare', 'NYSE',   5),
  ('TMO',   'sector_health', 'Thermo Fisher Scientific',   'Healthcare', 'NYSE',   6),
  ('DHR',   'sector_health', 'Danaher Corp.',              'Healthcare', 'NYSE',   7),
  ('AMGN',  'sector_health', 'Amgen Inc.',                 'Healthcare', 'NASDAQ', 8),
  ('ISRG',  'sector_health', 'Intuitive Surgical Inc.',    'Healthcare', 'NASDAQ', 9),
  ('VRTX',  'sector_health', 'Vertex Pharmaceuticals',     'Healthcare', 'NASDAQ', 10),
  ('REGN',  'sector_health', 'Regeneron Pharmaceuticals',  'Healthcare', 'NASDAQ', 11),
  ('GILD',  'sector_health', 'Gilead Sciences Inc.',       'Healthcare', 'NASDAQ', 12),
  ('BMY',   'sector_health', 'Bristol-Myers Squibb',       'Healthcare', 'NYSE',   13)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── SECTOR: Financial Services ───────────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('JPM',   'sector_finance', 'JPMorgan Chase & Co.',    'Financial Services', 'NYSE', 1),
  ('V',     'sector_finance', 'Visa Inc.',               'Financial Services', 'NYSE', 2),
  ('MA',    'sector_finance', 'Mastercard Inc.',         'Financial Services', 'NYSE', 3),
  ('BAC',   'sector_finance', 'Bank of America Corp.',   'Financial Services', 'NYSE', 4),
  ('WFC',   'sector_finance', 'Wells Fargo & Co.',       'Financial Services', 'NYSE', 5),
  ('GS',    'sector_finance', 'Goldman Sachs Group',     'Financial Services', 'NYSE', 6),
  ('MS',    'sector_finance', 'Morgan Stanley',          'Financial Services', 'NYSE', 7),
  ('SPGI',  'sector_finance', 'S&P Global Inc.',         'Financial Services', 'NYSE', 8),
  ('AXP',   'sector_finance', 'American Express Co.',    'Financial Services', 'NYSE', 9),
  ('BLK',   'sector_finance', 'BlackRock Inc.',          'Financial Services', 'NYSE', 10),
  ('C',     'sector_finance', 'Citigroup Inc.',          'Financial Services', 'NYSE', 11),
  ('CME',   'sector_finance', 'CME Group Inc.',          'Financial Services', 'NASDAQ',12)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── SECTOR: Energy ───────────────────────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('XOM',   'sector_energy', 'Exxon Mobil Corp.',      'Energy', 'NYSE', 1),
  ('CVX',   'sector_energy', 'Chevron Corp.',          'Energy', 'NYSE', 2),
  ('COP',   'sector_energy', 'ConocoPhillips',         'Energy', 'NYSE', 3),
  ('SLB',   'sector_energy', 'Schlumberger Ltd.',      'Energy', 'NYSE', 4),
  ('EOG',   'sector_energy', 'EOG Resources Inc.',     'Energy', 'NYSE', 5),
  ('MPC',   'sector_energy', 'Marathon Petroleum',     'Energy', 'NYSE', 6),
  ('PSX',   'sector_energy', 'Phillips 66',            'Energy', 'NYSE', 7),
  ('VLO',   'sector_energy', 'Valero Energy Corp.',    'Energy', 'NYSE', 8)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── SECTOR: Consumer ─────────────────────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('AMZN',  'sector_consumer', 'Amazon.com Inc.',           'Consumer Cyclical',  'NASDAQ', 1),
  ('TSLA',  'sector_consumer', 'Tesla Inc.',                'Consumer Cyclical',  'NASDAQ', 2),
  ('WMT',   'sector_consumer', 'Walmart Inc.',              'Consumer Defensive', 'NYSE',   3),
  ('HD',    'sector_consumer', 'Home Depot Inc.',           'Consumer Cyclical',  'NYSE',   4),
  ('COST',  'sector_consumer', 'Costco Wholesale Corp.',    'Consumer Defensive', 'NASDAQ', 5),
  ('MCD',   'sector_consumer', 'McDonald''s Corp.',         'Consumer Cyclical',  'NYSE',   6),
  ('NKE',   'sector_consumer', 'Nike Inc.',                 'Consumer Cyclical',  'NYSE',   7),
  ('KO',    'sector_consumer', 'Coca-Cola Co.',             'Consumer Defensive', 'NYSE',   8),
  ('PEP',   'sector_consumer', 'PepsiCo Inc.',              'Consumer Defensive', 'NASDAQ', 9),
  ('PG',    'sector_consumer', 'Procter & Gamble Co.',      'Consumer Defensive', 'NYSE',   10),
  ('SBUX',  'sector_consumer', 'Starbucks Corp.',           'Consumer Cyclical',  'NASDAQ', 11),
  ('TGT',   'sector_consumer', 'Target Corp.',              'Consumer Defensive', 'NYSE',   12)
ON CONFLICT (symbol, universe) DO NOTHING;

-- ── SECTOR: Industrial ───────────────────────────────────────────────────────
INSERT INTO market_universe (symbol, universe, company_name, sector, exchange, sort_order) VALUES
  ('HON',   'sector_industrial', 'Honeywell International', 'Industrial', 'NASDAQ', 1),
  ('UNP',   'sector_industrial', 'Union Pacific Corp.',     'Industrial', 'NYSE',   2),
  ('RTX',   'sector_industrial', 'RTX Corp.',               'Industrial', 'NYSE',   3),
  ('CAT',   'sector_industrial', 'Caterpillar Inc.',        'Industrial', 'NYSE',   4),
  ('GE',    'sector_industrial', 'GE Aerospace',            'Industrial', 'NYSE',   5),
  ('DE',    'sector_industrial', 'Deere & Co.',             'Industrial', 'NYSE',   6),
  ('ETN',   'sector_industrial', 'Eaton Corp. PLC',         'Industrial', 'NYSE',   7),
  ('EMR',   'sector_industrial', 'Emerson Electric Co.',    'Industrial', 'NYSE',   8),
  ('FDX',   'sector_industrial', 'FedEx Corp.',             'Industrial', 'NYSE',   9),
  ('UPS',   'sector_industrial', 'United Parcel Service',   'Industrial', 'NYSE',   10),
  ('LMT',   'sector_industrial', 'Lockheed Martin Corp.',   'Industrial', 'NYSE',   11)
ON CONFLICT (symbol, universe) DO NOTHING;
