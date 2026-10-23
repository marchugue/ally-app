export type EmailType = "chmsu" | "external" | "any";

export interface EmailAnalysis {
  isChmsu: boolean;
  isExternal: boolean;
  isTypo: boolean;
  typoMessage?: string;
  suggestedEmail?: string;
}

export const analyzeEmail = (rawEmail: string): EmailAnalysis => {
  const clean = rawEmail.trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return { isChmsu: false, isExternal: false, isTypo: false };
  }

  const atIndex = clean.lastIndexOf("@");
  const localPart = clean.substring(0, atIndex);
  const domain = clean.substring(atIndex + 1);

  if (!domain) {
    return { isChmsu: false, isExternal: false, isTypo: false };
  }

  // Exact CHMSU institutional domain
  if (domain === "chmsu.edu.ph") {
    return { isChmsu: true, isExternal: false, isTypo: false };
  }

  // Any domain that ends in .edu.ph but is not chmsu.edu.ph
  if (domain.endsWith(".edu.ph")) {
    return {
      isChmsu: false,
      isExternal: false,
      isTypo: true,
      typoMessage: "Did you mean @chmsu.edu.ph? Only CHMSU student accounts are supported for institutional registration.",
      suggestedEmail: `${localPart}@chmsu.edu.ph`,
    };
  }

  // Common CHMSU typos
  const chmsuTypos = [
    "chmsu.ph",
    "chmsu.edu",
    "chmsu.com",
    "chmsu.org",
    "chmsc.edu.ph",
    "chmsc.ph",
    "chmsc.edu",
    "cmsu.edu.ph",
    "cmsu.ph",
    "chmu.edu.ph",
    "chms.edu.ph",
    "chmsuedu.ph",
    "chmsu-edu.ph",
    "gmail.chmsu.edu.ph",
  ];

  if (chmsuTypos.includes(domain)) {
    return {
      isChmsu: false,
      isExternal: false,
      isTypo: true,
      typoMessage: "Did you mean @chmsu.edu.ph?",
      suggestedEmail: `${localPart}@chmsu.edu.ph`,
    };
  }

  // Valid personal/external domain (e.g. gmail.com, yahoo.com, outlook.com)
  if (domain.includes(".")) {
    return { isChmsu: false, isExternal: true, isTypo: false };
  }

  return { isChmsu: false, isExternal: false, isTypo: false };
};

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