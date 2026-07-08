export function validateBio(bio: string): string | null {
  if (bio.length > 250) {
    return 'Bio must be 250 characters or fewer';
  }

  return null;
}