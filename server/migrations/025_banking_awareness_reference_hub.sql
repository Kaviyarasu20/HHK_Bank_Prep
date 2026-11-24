-- Migration 025: Banking Awareness Reference Hub (Phase 4)
-- Safe, additive, idempotent migration compatible with both fresh databases and live
-- databases where earlier master-module tables may already exist.
-- Never fabricates current RBI rates, banking limits, or leadership appointments.

-- ============================================================================
-- A. RBI POLICY RATES (Current + Full Historical Records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_policy_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_code TEXT NOT NULL,
  rate_name TEXT NOT NULL,
  rate_value NUMERIC(6,3) NOT NULL CHECK (rate_value >= 0 AND rate_value <= 100),
  unit TEXT NOT NULL DEFAULT '%',
  effective_date DATE NOT NULL,
  previous_value NUMERIC(6,3),
  change_value NUMERIC(6,3),
  announcement_note TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT 'Reserve Bank of India',
  source_url TEXT NOT NULL DEFAULT '',
  source_published_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE banking_policy_rates
  ADD COLUMN IF NOT EXISTS rate_code TEXT,
  ADD COLUMN IF NOT EXISTS rate_name TEXT,
  ADD COLUMN IF NOT EXISTS rate_value NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '%',
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS previous_value NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS change_value NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS announcement_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT 'Reserve Bank of India',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bpr_code_status_effective
  ON banking_policy_rates(rate_code, status, effective_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bpr_code_effective_active
  ON banking_policy_rates(lower(rate_code), effective_date)
  WHERE status IN ('approved', 'published') AND rate_code IS NOT NULL AND effective_date IS NOT NULL;

-- ============================================================================
-- B. BANKING LIMITS & FINANCIAL TARGETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other Banking Limits',
  description TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  applicable_to TEXT NOT NULL DEFAULT '',
  effective_from DATE,
  effective_until DATE,
  exam_notes TEXT NOT NULL DEFAULT '',
  importance_level TEXT NOT NULL DEFAULT 'important',
  target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE banking_limits
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Other Banking Limits',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS value TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS applicable_to TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_until DATE,
  ADD COLUMN IF NOT EXISTS exam_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS importance_level TEXT NOT NULL DEFAULT 'important',
  ADD COLUMN IF NOT EXISTS target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bl_status_category
  ON banking_limits(status, category);

-- ============================================================================
-- C. BANKING INSTITUTIONS DIRECTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  institution_type TEXT NOT NULL DEFAULT 'Other Financial Organization',
  established_year INTEGER,
  headquarters TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  official_website TEXT NOT NULL DEFAULT '',
  parent_organization TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE banking_institutions
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS short_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS institution_type TEXT NOT NULL DEFAULT 'Other Financial Organization',
  ADD COLUMN IF NOT EXISTS established_year INTEGER,
  ADD COLUMN IF NOT EXISTS headquarters TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS official_website TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_organization TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bi_status_type
  ON banking_institutions(status, institution_type);

-- ============================================================================
-- D. REGULATORY BODIES DIRECTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_regulatory_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  regulatory_domain TEXT NOT NULL DEFAULT '',
  responsibilities TEXT NOT NULL DEFAULT '',
  established_year INTEGER,
  headquarters TEXT NOT NULL DEFAULT '',
  official_website TEXT NOT NULL DEFAULT '',
  applicable_sector TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_brb_status_sector
  ON banking_regulatory_bodies(status, applicable_sector);

-- ============================================================================
-- E. BANKING LEADERS & IMPORTANT APPOINTMENTS (Current + History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  designation TEXT NOT NULL,
  organization_id UUID REFERENCES banking_institutions(id) ON DELETE SET NULL,
  organization_name TEXT NOT NULL DEFAULT '',
  appointment_date DATE,
  end_date DATE,
  previous_designation TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE banking_leaders
  ADD COLUMN IF NOT EXISTS person_name TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES banking_institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS appointment_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS previous_designation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blead_status_end
  ON banking_leaders(status, end_date, appointment_date DESC);

-- ============================================================================
-- F. BANKING STATIC GK
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_static_gk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'Banking History',
  description TEXT NOT NULL DEFAULT '',
  key_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  importance_level TEXT NOT NULL DEFAULT 'important',
  target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE banking_static_gk
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT 'Banking History',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS key_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS importance_level TEXT NOT NULL DEFAULT 'important',
  ADD COLUMN IF NOT EXISTS target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bsgk_status_topic
  ON banking_static_gk(status, topic);

-- ============================================================================
-- G. BANKING TERMINOLOGY (A-Z Glossary)
-- ============================================================================
CREATE TABLE IF NOT EXISTS banking_terminology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  abbreviation TEXT NOT NULL DEFAULT '',
  full_form TEXT NOT NULL DEFAULT '',
  definition TEXT NOT NULL,
  example TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General Banking',
  importance_level TEXT NOT NULL DEFAULT 'important',
  target_exams JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_name TEXT NOT NULL DEFAULT 'Reserve Bank of India',
  source_url TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bt_lower_term
  ON banking_terminology(lower(term));

CREATE INDEX IF NOT EXISTS idx_bt_status_cat_term
  ON banking_terminology(status, category, lower(term));

-- ============================================================================
-- H. SEED TIMELESS BANKING TERMINOLOGY DEFINITIONS ONLY
-- (Zero fabricated RBI rates, limits, or leadership appointments are seeded.)
-- ============================================================================
INSERT INTO banking_terminology
  (term, abbreviation, full_form, definition, example, category, importance_level, target_exams, source_name, source_url, verified_at, status)
VALUES
  ('Cash Reserve Ratio', 'CRR', 'Cash Reserve Ratio', 'The percentage of a scheduled bank''s Net Demand and Time Liabilities (NDTL) that it must maintain as cash balances with the Reserve Bank of India.', 'Banks do not earn interest on CRR balances held with RBI.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","RBI Grade B"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Statutory Liquidity Ratio', 'SLR', 'Statutory Liquidity Ratio', 'The minimum percentage of NDTL that commercial banks must maintain in liquid assets such as cash, gold, or approved government securities before extending credit.', 'Increasing SLR reduces the lendable funds available with banks.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","RBI Grade B"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Repo Rate', 'Repo', 'Repurchase Option Rate', 'The policy interest rate at which the Reserve Bank of India lends short-term funds to commercial banks against approved government securities under the Liquidity Adjustment Facility (LAF).', 'A higher repo rate generally makes bank loans costlier to curb inflation.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","RBI Grade B"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Reverse Repo Rate', 'Reverse Repo', 'Reverse Repurchase Rate', 'The interest rate at which the Reserve Bank of India absorbs short-term liquidity from commercial banks against eligible government securities.', 'RBI uses reverse repo operations to absorb excess liquidity in the banking system.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Standing Deposit Facility', 'SDF', 'Standing Deposit Facility', 'A collateral-free liquidity absorption tool introduced by RBI that acts as the floor of the LAF corridor, allowing banks to park excess overnight funds with RBI.', 'Unlike reverse repo, SDF does not require RBI to provide government securities as collateral.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","RBI Grade B"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Marginal Standing Facility', 'MSF', 'Marginal Standing Facility', 'An overnight emergency borrowing window through which scheduled commercial banks can borrow funds from RBI above the repo rate by dipping into their SLR portfolio up to a prescribed limit.', 'MSF rate serves as the upper ceiling of the LAF interest rate corridor.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","RBI Grade B"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Non-Performing Asset', 'NPA', 'Non-Performing Asset', 'A loan or advance for which the principal or interest payment remains overdue for a period of more than 90 days (or two crop seasons for short-duration agricultural loans).', 'NPAs are classified into Sub-standard, Doubtful, and Loss assets based on overdue duration.', 'Credit & Risk', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('CASA Ratio', 'CASA', 'Current Account and Savings Account Ratio', 'The proportion of a bank''s total deposits held in low-cost current and savings accounts rather than higher-interest term deposits.', 'A higher CASA ratio lowers a bank''s cost of funds and improves net interest margins.', 'General Banking', 'important', '["IBPS PO","SBI PO","IBPS Clerk"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('NEFT', 'NEFT', 'National Electronic Funds Transfer', 'A nationwide electronic payment system operated by RBI enabling one-to-one funds transfers settled in half-hourly batches, available 24x7x365.', 'NEFT has no minimum or maximum transfer value limit prescribed by RBI.', 'Payment Systems', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","IBPS RRB PO"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('RTGS', 'RTGS', 'Real Time Gross Settlement', 'An RBI-operated high-value electronic funds transfer system where transactions are settled individually and continuously in real time, available 24x7x365.', 'RTGS is designed for large-value interbank and customer transfers.', 'Payment Systems', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('IMPS', 'IMPS', 'Immediate Payment Service', 'An instant 24x7 interbank electronic funds transfer service operated by NPCI across mobile, internet banking, and ATM channels.', 'IMPS settles funds immediately even on bank holidays.', 'Payment Systems', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk"]'::jsonb, 'NPCI', 'https://www.npci.org.in/', now(), 'published'),
  ('UPI', 'UPI', 'Unified Payments Interface', 'An instant real-time payment system developed by NPCI that powers multiple bank accounts into a single mobile application using Virtual Payment Addresses (VPAs).', 'Users can pay merchants via QR codes or VPA without sharing bank account numbers.', 'Payment Systems', 'must_study', '["IBPS PO","SBI PO","IBPS Clerk","SBI Clerk","IBPS RRB Office Assistant"]'::jsonb, 'NPCI', 'https://www.npci.org.in/', now(), 'published'),
  ('NACH', 'NACH', 'National Automated Clearing House', 'A centralized web-based clearing service operated by NPCI for high-volume, repetitive interbank transactions such as salaries, dividends, subsidies, and EMI debits.', 'NACH consolidated multiple regional Electronic Clearing Service (ECS) systems.', 'Payment Systems', 'important', '["IBPS PO","SBI PO","IBPS Clerk"]'::jsonb, 'NPCI', 'https://www.npci.org.in/', now(), 'published'),
  ('CTS', 'CTS', 'Cheque Truncation System', 'An image-based cheque clearing system introduced by RBI that stops the physical movement of cheques and clears them using electronic images and MICR data.', 'CTS reduces cheque clearing time and operational costs across banks.', 'Payment Systems', 'important', '["IBPS Clerk","SBI Clerk","IBPS RRB PO"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Basel Norms', 'Basel III', 'Basel Accords (BCBS Capital Standards)', 'International banking regulatory frameworks issued by the Basel Committee on Banking Supervision (BCBS) to strengthen bank capital adequacy, stress testing, and liquidity risk management.', 'Basel III sets minimum Capital Adequacy Ratio (CRAR), Capital Conservation Buffer, and Liquidity Coverage Ratio standards.', 'Credit & Risk', 'must_study', '["IBPS PO","SBI PO","RBI Grade B"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published'),
  ('Monetary Policy Committee', 'MPC', 'Monetary Policy Committee', 'A six-member statutory committee constituted under Section 45ZB of the RBI Act, 1934, responsible for fixing the benchmark policy repo rate to achieve the inflation target.', 'The MPC comprises 3 RBI officials (chaired by the RBI Governor) and 3 external members appointed by the Central Government.', 'Monetary Policy', 'must_study', '["IBPS PO","SBI PO","RBI Grade B","NABARD Grade A"]'::jsonb, 'Reserve Bank of India', 'https://www.rbi.org.in/', now(), 'published')
ON CONFLICT (lower(term)) DO NOTHING;
