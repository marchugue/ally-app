export function validateUsername(username: string): string | null {
  if (!username.trim()) {
    return "Username is required";
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return "3–20 chars, letters/numbers/underscores only";
  }

  return null;
}