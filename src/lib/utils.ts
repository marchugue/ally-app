type ClassValue = string | number | null | boolean | undefined;

/**
 * Lightweight className combiner. Filters falsy values and joins with a space.
 * Sufficient for NativeWind use without pulling in clsx/tailwind-merge.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
