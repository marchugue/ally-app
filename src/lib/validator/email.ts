export function validateEmail(email: string): string | null {
  const value = email.trim().toLowerCase();

  // General email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(value)) {
    return "Please enter a valid email address.";
  }

  // Optional: Only allow CHMSU email
  if (!value.endsWith("@chmsu.edu.ph")) {
    return "Please use your CHMSU email.";
  }

  return null;
}