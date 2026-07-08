export function validatePass(pass: string): string | null {
  const value = pass.trim();

  const minLength = 6;

  if (value.length < minLength && value.length > 0) {
    return "Password must be at least 6 characters.";
  }

  return null;
}