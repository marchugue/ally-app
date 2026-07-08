export function validateInterests(interests: string[]): string | undefined {
  if (interests.length < 3) {
    return "Select at least 3 interests";
  }

  return undefined;
}