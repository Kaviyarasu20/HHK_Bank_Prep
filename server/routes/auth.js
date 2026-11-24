import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, validate } from "../middleware.js";
import { emailSchema, loginSchema, registerSchema } from "../schemas.js";

export const authRouter = Router();
const limiterOptions = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
};
const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  ...limiterOptions,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  ...limiterOptions,
});
const forgotLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  ...limiterOptions,
});
const registerOtpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  ...limiterOptions,
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  ...limiterOptions,
});

const failedLoginMap = new Map();

function getLockoutStatus(email) {
  const key = email.toLowerCase();
  const record = failedLoginMap.get(key);
  if (!record || !record.lockedUntil) return { locked: false };
  const now = Date.now();
  if (now > record.lockedUntil) {
    failedLoginMap.delete(key);
    return { locked: false };
  }
  const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
  return { locked: true, waitMinutes };
}

function handleFailedLogin(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = failedLoginMap.get(key) ?? { attempts: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000;
  }
  failedLoginMap.set(key, record);
}

function handleSuccessfulLogin(email) {
  failedLoginMap.delete(email.toLowerCase());
}

const userFields = "id,email,full_name,mobile,role,created_at";
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  mobile: u.mobile,
  role: u.role,
  createdAt: u.created_at,
});
const regen = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
const save = (req) =>
  new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );

authRouter.post("/send-register-otp", registerOtpLimiter, async (req, res) => {
  const { email } = validate(z.object({ email: emailSchema }), req.body);

  const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rowCount) {
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });
  }

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  const isDev = process.env.NODE_ENV !== "production";
  if (!smtpConfigured && !isDev) {
    return res.status(503).json({
      error: "Email OTP service is not configured. Contact an administrator.",
    });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = crypto
    .createHash("sha256")
    .update(`${email}:${otp}`)
    .digest("hex");

  await pool.query(
    "UPDATE email_verification_otps SET used_at=now() WHERE email=$1 AND used_at IS NULL",
    [email],
  );
  await pool.query(
    "INSERT INTO email_verification_otps(email, otp_hash, expires_at) VALUES($1, $2, now() + interval '10 minutes')",
    [email, otpHash],
  );

  if (!smtpConfigured && isDev) {
    console.log(`\n[DEV REGISTER OTP] ${email} -> ${otp}\n`);
    return res.json({ message: "Dev mode: check your terminal for the 6-digit OTP." });
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Your HHK Registration OTP",
      text: `Your HHK verification code is ${otp}. It is valid for 10 minutes. Do not share this code with anyone.`,
      html: `<p>Welcome to <strong>HHK Banking Exam Prep</strong>!</p><p>Your 6-digit email verification OTP is:</p><h2 style="letter-spacing:4px;">${otp}</h2><p>This code expires in 10 minutes.</p>`,
    });
  } catch (err) {
    console.error("[SMTP ERROR] Failed to send registration OTP:", err.message);
    return res.status(502).json({
      error: "Could not send OTP email right now. Please try again.",
    });
  }

  res.json({ message: "A 6-digit OTP has been sent to your email." });
});

authRouter.post("/register", registerLimiter, async (req, res) => {
  const input = validate(registerSchema, req.body);
  const hash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const otpRow = await client.query(
      `SELECT id, otp_hash, attempts
       FROM email_verification_otps
       WHERE email=$1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [input.email],
    );
    if (!otpRow.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "OTP expired or not requested. Click 'Send OTP' first.",
      });
    }
    if (otpRow.rows[0].attempts >= 5) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        error: "Too many wrong OTP attempts. Please request a new OTP.",
      });
    }
    const providedHash = crypto
      .createHash("sha256")
      .update(`${input.email}:${input.otp}`)
      .digest("hex");
    const validOtp = crypto.timingSafeEqual(
      Buffer.from(otpRow.rows[0].otp_hash, "utf8"),
      Buffer.from(providedHash, "utf8"),
    );
    if (!validOtp) {
      await client.query("ROLLBACK");
      await pool.query(
        "UPDATE email_verification_otps SET attempts = attempts + 1 WHERE id=$1",
        [otpRow.rows[0].id],
      );
      return res.status(400).json({
        error: "Incorrect OTP. Please check your email and try again.",
      });
    }

    await client.query(
      "UPDATE email_verification_otps SET used_at=now() WHERE id=$1",
      [otpRow.rows[0].id],
    );

    const inserted = await client.query(
      `INSERT INTO users(email,full_name,mobile,password_hash,role,email_verified,email_verified_at)
       VALUES($1,$2,$3,$4,'student',true,now()) RETURNING ${userFields}`,
      [input.email, input.fullName, input.mobile, hash],
    );
    
    await client.query("COMMIT");
    await regen(req);
    req.session.userId = inserted.rows[0].id;
    req.session.role = "student";
    await save(req);
    res.status(201).json({ user: publicUser(inserted.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    throw error;
  } finally {
    client.release();
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const input = validate(loginSchema, req.body);
  const lockout = getLockoutStatus(input.email);
  if (lockout.locked) {
    return res.status(429).json({
      error: `Account temporarily locked due to multiple failed sign-in attempts. Please try again in ${lockout.waitMinutes} minutes.`,
    });
  }
  const result = await pool.query(
    `SELECT ${userFields},password_hash,is_active FROM users WHERE email=$1`,
    [input.email],
  );
  const u = result.rows[0];
  if (
    !u ||
    !u.is_active ||
    !(await bcrypt.compare(input.password, u.password_hash))
  ) {
    handleFailedLogin(input.email);
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  handleSuccessfulLogin(input.email);
  if (input.acceptedTerms) {
    await pool.query(
      `INSERT INTO policy_acceptances(user_id, policy_type, policy_version, context, ip_address, user_agent)
       VALUES($1, 'TERMS', $2, 'login', $3, $4)`,
      [u.id, input.policyVersion || "1.0", req.ip ?? null, req.headers["user-agent"] ?? null]
    ).catch(() => {});
  }
  await regen(req);
  req.session.userId = u.id;
  req.session.role = u.role;
  await save(req);
  res.json({ user: publicUser(u) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT ${userFields} FROM users WHERE id=$1 AND is_active=true`,
    [req.session.userId],
  );
  if (!result.rowCount)
    return res.status(401).json({ error: "Account unavailable." });
  const profile = await pool.query(
    "SELECT target_exam_id,preparation_status,profile_picture_url FROM user_profiles WHERE user_id=$1",
    [req.session.userId],
  );
  res.json({
    user: publicUser(result.rows[0]),
    profile: profile.rows[0] ?? null,
  });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  await new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve())),
  );
  res.clearCookie("hhk.sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(204).end();
});

authRouter.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email } = validate(z.object({ email: emailSchema }), req.body);
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  const isDev = process.env.NODE_ENV !== "production";

  if (!smtpConfigured && !isDev) {
    return res.status(503).json({
      error: "Password reset email is not configured. Contact an administrator.",
    });
  }

  const response = {
    message:
      "If an account exists for that email, password reset instructions will be sent.",
  };
  const user = await pool.query(
    "SELECT id,email,full_name FROM users WHERE email=$1 AND is_active=true",
    [email],
  );
  if (!user.rowCount) return res.json(response);

  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.query(
    "UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
    [user.rows[0].id],
  );
  await pool.query(
    "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
    [user.rows[0].id, hash],
  );

  const base = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const resetUrl = `${base}/?reset=${encodeURIComponent(token)}`;

  if (!smtpConfigured && isDev) {
    console.log(`\n[DEV PASSWORD RESET] ${user.rows[0].email} -> ${resetUrl}\n`);
    return res.json({
      message: "Dev mode: check your server terminal for the password reset link.",
    });
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.rows[0].email,
      subject: "Reset your HHK password",
      text: `Hello ${user.rows[0].full_name},\n\nUse this link within 30 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Hello ${user.rows[0].full_name},</p><p>Click the link below within 30 minutes to reset your HHK password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error("[SMTP ERROR] Failed to send reset email:", err.message);
    return res.status(502).json({
      error: "Could not send reset email right now. Please verify SMTP settings.",
    });
  }

  res.json(response);
});

authRouter.post("/reset-password", resetLimiter, async (req, res) => {
  const input = validate(
    z
      .object({
        token: z.string().min(20).max(200),
        password: z
          .string()
          .min(6)
          .max(128)
          .refine((value) => new TextEncoder().encode(value).length <= 72, {
            message: "Password must be at most 72 UTF-8 bytes.",
          }),
        passwordConfirmation: z.string().min(6).max(128),
      })
      .refine((v) => v.password === v.passwordConfirmation, {
        path: ["passwordConfirmation"],
        message: "Passwords do not match.",
      }),
    req.body,
  );
  const tokenHash = crypto
    .createHash("sha256")
    .update(input.token)
    .digest("hex");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const token = await client.query(
      "SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
      [tokenHash],
    );
    if (!token.rowCount) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({
          error: "Reset link is invalid or expired. Request a new one.",
        });
    }
    await client.query(
      "UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1",
      [token.rows[0].user_id, passwordHash],
    );
    await client.query(
      "UPDATE password_reset_tokens SET used_at=now() WHERE id=$1",
      [token.rows[0].id],
    );
    await client.query("COMMIT");
    try {
      await pool.query("DELETE FROM user_sessions WHERE sess->>'userId'=$1", [
        token.rows[0].user_id,
      ]);
    } catch {
      console.error(
        "Could not invalidate existing sessions after password reset.",
      );
    }
    res.json({
      message: "Password reset. You can sign in with your new password.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const input = validate(
    z.object({
      fullName: z.string().trim().min(2).max(100),
      mobile: z
        .string()
        .trim()
        .regex(/^\+?[0-9][0-9\s()-]{7,18}$/),
      targetExamId: z.string().uuid().nullable().optional(),
      preparationStatus: z
        .enum(["starting", "preparing", "revision"])
        .optional(),
    }),
    req.body,
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (Object.hasOwn(input, "targetExamId") && input.targetExamId) {
      const target = await client.query(
        "SELECT id FROM exams WHERE id=$1 AND status<>'archived' FOR SHARE",
        [input.targetExamId],
      );
      if (!target.rowCount) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            error: "Choose an active examination from the catalogue as your target.",
          });
      }
    }
    await client.query(
      "UPDATE users SET full_name=$2,mobile=$3,updated_at=now() WHERE id=$1",
      [req.session.userId, input.fullName, input.mobile],
    );
    await client.query(
      "UPDATE user_profiles SET target_exam_id=CASE WHEN $2 THEN $3::uuid ELSE target_exam_id END,preparation_status=COALESCE($4,preparation_status),updated_at=now() WHERE user_id=$1",
      [
        req.session.userId,
        Object.hasOwn(input, "targetExamId"),
        input.targetExamId ?? null,
        input.preparationStatus ?? null,
      ],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
