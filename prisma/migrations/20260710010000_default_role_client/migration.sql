-- Least-privilege default role.
--
-- `User.role` defaulted to EMPLOYEE, so any account created through better-auth's
-- public signUp endpoint (POST /api/auth/sign-up/email) became staff. The public
-- /sign-up page is being removed, but the endpoint stays reachable because the
-- customer portal's account setup uses it.
--
-- Defaulting to CLIENT means that endpoint can only ever mint a customer.
-- Admin-created staff is unaffected: createEmployee sets `role` explicitly.
--
-- Existing rows are not touched -- this changes the default for new rows only.

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
