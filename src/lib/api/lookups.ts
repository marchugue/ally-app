import { apiRequest } from "./client";
import type { Lookups } from "@/types/lookup";

/** Public — used on the registration form. */
export function getLookups(): Promise<Lookups> {
  return apiRequest<Lookups>("/lookups");
}