export type EmailType = "chmsu" | "external" | "any";

export function validateEmail(
  email: string,
  emailType: EmailType = "any"
): string | null {
  const value = email.trim().toLowerCase();

  if (!value) {
    return "Email address is required.";
  }

  // General email syntax validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return "Please enter a valid email address.";
  }

  // Enforce @chmsu.edu.ph domain only when CHMSU email type is selected
  if (emailType === "chmsu" && !value.endsWith("@chmsu.edu.ph")) {
    return "CHMSU email must end with @chmsu.edu.ph.";
  }

  return null;
}