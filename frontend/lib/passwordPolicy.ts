/**
 * Client-side password rules (aligned with common SaaS / OWASP-style practice).
 * Firebase still enforces its own minimum; we stay stricter in the UI to reduce weak accounts.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = {
  key: "length" | "upper" | "lower" | "digit" | "symbol";
  label: string;
  met: boolean;
};

/** At least one character that is not a letter, digit, or whitespace (covers common symbols). */
function hasSymbol(password: string): boolean {
  return /[^A-Za-z0-9\s]/.test(password);
}

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    {
      key: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters (max ${PASSWORD_MAX_LENGTH})`,
      met:
        password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      key: "upper",
      label: "One uppercase letter (A–Z)",
      met: /[A-Z]/.test(password),
    },
    {
      key: "lower",
      label: "One lowercase letter (a–z)",
      met: /[a-z]/.test(password),
    },
    {
      key: "digit",
      label: "One number (0–9)",
      met: /\d/.test(password),
    },
    {
      key: "symbol",
      label: "One symbol (e.g. ! @ # $ % ^ & * . , ?)",
      met: hasSymbol(password),
    },
  ];
}

export function passwordMeetsPolicy(password: string): boolean {
  return getPasswordRules(password).every((r) => r.met);
}

/** First human-readable failure for form error banners. */
export function passwordPolicyErrorMessage(password: string): string | null {
  if (!password.trim()) return "Enter a password.";
  for (const r of getPasswordRules(password)) {
    if (!r.met) return `Missing requirement: ${r.label}.`;
  }
  return null;
}

/** Blocks passwords that contain most of the email local-part (reduces obvious guessing). */
export function passwordEmailConflictMessage(
  password: string,
  email: string
): string | null {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  if (local.length < 4) return null;
  const p = password.toLowerCase();
  if (p.includes(local)) {
    return "Do not include your email username inside your password.";
  }
  return null;
}
