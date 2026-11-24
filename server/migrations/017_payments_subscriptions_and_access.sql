-- Migration 017: Production Payment System, Subscriptions, Free/Paid Test Access, Refunds & Legal Compliance
-- Safe, additive, idempotent migration: preserves all existing users, exams, questions, mock_tests, and attempts.

-- 1. Extend mock_tests with Admin-Controlled Free/Paid Access & Pricing (integer paise)
ALTER TABLE mock_tests
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS price_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS access_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS promotional_free_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS difficulty_label TEXT NOT NULL DEFAULT 'Moderate';

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_access_type_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_access_type_check
  CHECK (access_type IN ('FREE', 'PAID', 'SUBSCRIPTION', 'PROMOTIONAL'));

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_price_paise_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_price_paise_check
  CHECK (price_paise >= 0);

ALTER TABLE mock_tests DROP CONSTRAINT IF EXISTS mock_tests_access_duration_days_check;
ALTER TABLE mock_tests
  ADD CONSTRAINT mock_tests_access_duration_days_check
  CHECK (access_duration_days IS NULL OR access_duration_days > 0);

CREATE INDEX IF NOT EXISTS idx_mock_tests_public_listing
  ON mock_tests(status, is_visible, access_type, test_type);

-- 2. Subscription Plans (Admin Configurable - Zero Hardcoded Prices)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  promo_price_paise INTEGER CHECK (promo_price_paise IS NULL OR promo_price_paise >= 0),
  promo_valid_until TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'INR',
  access_scope TEXT NOT NULL DEFAULT 'ALL_TESTS' CHECK (access_scope IN ('ALL_TESTS', 'SELECTED_TESTS', 'LIMITED_COUNT')),
  max_tests_included INTEGER CHECK (max_tests_included IS NULL OR max_tests_included > 0),
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
  ON subscription_plans(is_active, sort_order);

-- 3. Subscription Plan <-> Mock Test Mapping (for SELECTED_TESTS or eligible plan mapping)
CREATE TABLE IF NOT EXISTS subscription_plan_tests (
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, mock_test_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_tests_mock_test
  ON subscription_plan_tests(mock_test_id);

-- 4. Global Payment & Business Settings (Singleton row id=1; NEVER stores gateway secrets)
CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gateway_provider TEXT NOT NULL DEFAULT 'razorpay',
  gateway_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  gateway_mode TEXT NOT NULL DEFAULT 'test' CHECK (gateway_mode IN ('test', 'live')),
  currency TEXT NOT NULL DEFAULT 'INR',
  allow_individual_test_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  allow_subscription_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 5000),
  tax_label TEXT NOT NULL DEFAULT 'GST',
  refund_window_days INTEGER NOT NULL DEFAULT 7 CHECK (refund_window_days >= 0),
  refund_processing_days TEXT NOT NULL DEFAULT '5-7 business days',
  support_email TEXT NOT NULL DEFAULT '',
  support_phone TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT 'HHK Banking Examination Preparation Platform',
  business_address TEXT NOT NULL DEFAULT '',
  policy_version TEXT NOT NULL DEFAULT '1.0',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Payment Orders (Internal order with idempotency and immutable pricing snapshot in paise)
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK (item_type IN ('MOCK_TEST', 'SUBSCRIPTION')),
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE RESTRICT,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  item_title TEXT NOT NULL,
  base_amount_paise INTEGER NOT NULL CHECK (base_amount_paise >= 0),
  tax_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount_paise >= 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (
    status IN (
      'CREATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL',
      'FAILED', 'CANCELLED', 'REFUND_INITIATED', 'PARTIALLY_REFUNDED', 'REFUNDED'
    )
  ),
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT payment_orders_target_check CHECK (
    (item_type = 'MOCK_TEST' AND mock_test_id IS NOT NULL AND plan_id IS NULL)
    OR
    (item_type = 'SUBSCRIPTION' AND plan_id IS NOT NULL AND mock_test_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_student_created
  ON payment_orders(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status
  ON payment_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway_order
  ON payment_orders(gateway_order_id) WHERE gateway_order_id IS NOT NULL;

-- 6. Payment Transactions (Audit-grade gateway attempt and capture records)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id TEXT,
  gateway_payment_id TEXT UNIQUE,
  gateway_signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  refunded_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_paise >= 0 AND refunded_amount_paise <= amount_paise),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (
    status IN (
      'CREATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL',
      'FAILED', 'CANCELLED', 'REFUND_INITIATED', 'PARTIALLY_REFUNDED', 'REFUNDED'
    )
  ),
  error_code TEXT,
  error_description TEXT,
  receipt_number TEXT UNIQUE,
  gateway_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_student_created
  ON payment_transactions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order
  ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status_created
  ON payment_transactions(status, created_at DESC);

-- 7. Payment Webhook Events (Idempotent replay protection)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type_received
  ON payment_webhook_events(event_type, received_at DESC);

-- 8. Student Subscriptions (Unique order_id prevents duplicate activation)
CREATE TABLE IF NOT EXISTS student_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  order_id UUID UNIQUE REFERENCES payment_orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'REVOKED')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_active
  ON student_subscriptions(student_id, status, expires_at DESC);

-- 9. Student Individual Mock Test Entitlements (Preserved across future price changes)
CREATE TABLE IF NOT EXISTS student_test_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('PURCHASE', 'PROMOTIONAL', 'ADMIN_GRANT')),
  order_id UUID UNIQUE REFERENCES payment_orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_entitlements_lookup
  ON student_test_entitlements(student_id, mock_test_id, status);

-- 10. Refund Requests & Gateway Refund Tracking
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_amount_paise INTEGER NOT NULL CHECK (requested_amount_paise > 0),
  reason_category TEXT NOT NULL,
  reason_details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (
    status IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REFUND_INITIATED', 'REFUNDED', 'FAILED')
  ),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT,
  gateway_refund_id TEXT UNIQUE,
  gateway_refund_status TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_student
  ON refund_requests(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status
  ON refund_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_tx
  ON refund_requests(transaction_id);

-- 11. Policy Acceptance Audit Records (Registration & Checkout)
CREATE TABLE IF NOT EXISTS policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('TERMS', 'PRIVACY', 'REFUND', 'CHECKOUT_BUNDLE')),
  policy_version TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'registration',
  ip_address INET,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user
  ON policy_acceptances(user_id, accepted_at DESC);

-- 12. Support & Payment/Refund Inquiries
CREATE TABLE IF NOT EXISTS support_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('GENERAL', 'PAYMENT', 'REFUND', 'TECHNICAL', 'EXAM_CONTENT')),
  transaction_id TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_inquiries_status
  ON support_inquiries(status, created_at DESC);
