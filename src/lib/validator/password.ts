export interface PasswordRule {
  key: string;
  label: string;
  test: (p: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length',    label: 'At least 8 characters',      test: (p) => p.length >= 8 },
  { key: 'upper',     label: 'One uppercase letter (A–Z)',  test: (p) => /[A-Z]/.test(p) },
  { key: 'lower',     label: 'One lowercase letter (a–z)',  test: (p) => /[a-z]/.test(p) },
  { key: 'digit',     label: 'One number (0–9)',            test: (p) => /[0-9]/.test(p) },
  { key: 'special',   label: 'One special character (!@#…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Returns null if valid, or an error string listing what's missing. */
export function validatePass(pass: string): string | null {
  if (!pass || pass.trim().length === 0) return null; // let required check handle empty

  const failed = PASSWORD_RULES.filter((r) => !r.test(pass));
  if (failed.length === 0) return null;

  if (failed.length === PASSWORD_RULES.length) {
    return 'Password must be at least 8 characters with uppercase, lowercase, digit, and special character.';
  }

  return `Missing: ${failed.map((r) => r.label.split('(')[0].trim()).join(', ')}.`;
}

/** Returns 0–100 strength score. */
export function passwordStrength(pass: string): number {
  if (!pass) return 0;
  const passed = PASSWORD_RULES.filter((r) => r.test(pass)).length;
  return Math.round((passed / PASSWORD_RULES.length) * 100);
}