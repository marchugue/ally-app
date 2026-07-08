import type { RegisterFormData, RegisterPayload } from "@/types/auth";

export function buildRegisterPayload(form: RegisterFormData): RegisterPayload {
  return {
    email: form.email.trim(),
    password: form.password,
    username: form.username.trim().toLowerCase(),
    bio: form.bio.trim() || null,
    department: form.department || null,
    course: form.course || null,
    year_level: form.yearLevel || null,
    interests: form.interests,
    organizations: form.organizations,
    avatar_url: form.avatar || null,
  };
}