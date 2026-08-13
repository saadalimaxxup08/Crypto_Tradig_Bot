-- Supabase Database Schema for CryptoAI Trader 100$
-- Execute these SQL queries in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Drop existing tables if they exist (Caution: this will delete existing data)
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS signals;
DROP TABLE IF EXISTS settings;

-- 2. Create settings Table
CREATE TABLE settings (
  id INT PRIMARY KEY DEFAULT 1,
  bot_enabled BOOLEAN DEFAULT false,
  tp_percent NUMERIC DEFAULT 2.0,
  sl_percent NUMERIC DEFAULT 1.0,
  risk_amount NUMERIC DEFAULT 10.0, -- USD risk per trade (e.g. 10 USDT)
  pairs TEXT[] DEFAULT ARRAY['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT', 'AVAXUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT'],
  telegram_token TEXT,
  telegram_chat_id TEXT,
  binance_api_key TEXT,
  binance_secret_key TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT null
);

-- 3. Create signals Table
CREATE TABLE signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'LONG' | 'SHORT'
  rsi NUMERIC NOT NULL,
  macd_line NUMERIC NOT NULL,
  signal_line NUMERIC NOT NULL,
  price NUMERIC NOT NULL
);

-- 4. Create trades Table
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'LONG' | 'SHORT'
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  amount NUMERIC NOT NULL,
  tp_price NUMERIC NOT NULL,
  sl_price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'
  pnl NUMERIC,
  closed_at TIMESTAMP WITH TIME ZONE,
  binance_order_id TEXT
);

-- 5. Insert default configurations (Single row settings entry)
INSERT INTO settings (
  id, 
  bot_enabled, 
  tp_percent, 
  sl_percent, 
  risk_amount, 
  pairs
) VALUES (
  1, 
  false, 
  2.0, 
  1.0, 
  10.0, 
  ARRAY['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT', 'AVAXUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT']
) ON CONFLICT (id) DO NOTHING;

-- 6. Disable RLS policies for simplicity or enable them as needed
-- Note: Since the Next.js API endpoints connect via the Supabase Service Role Key, 
-- they bypass RLS restrictions automatically, so you do not need public write access policies.
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
