import { router } from "expo-router";
type Router = typeof router;
import * as authApi from "@/lib/api/auth";
import { uploadStudentIdFile } from "@/lib/api/media";
import { getMobileRegisterCache, saveMobileRegisterCache } from "@/lib/registerCache";
import type { AuthSession } from "@/types/auth";
import {
  resolveOAuthNavigationTarget,
  type OAuthNavigationTarget,
} from "./googleOAuth";

export type OAuthPostLoginResult = {
  session: AuthSession;
  target: OAuthNavigationTarget;
};

/**
 * After Google OAuth session is applied: upload cached student ID (external),
 * refresh session, update register cache, and compute the next screen (web ConfirmPage parity).
 */
export async function completeOAuthPostLogin(
  session: AuthSession,
  localOverrides?: { frontUri?: string | null; backUri?: string | null }
): Promise<OAuthPostLoginResult> {
  const cached = await getMobileRegisterCache();
  const effectiveFront =
    localOverrides?.frontUri ?? cached?.studentIdFrontUri ?? null;
  const effectiveBack =
    localOverrides?.backUri ?? cached?.studentIdBackUri ?? null;
  const hasCachedId = Boolean(effectiveFront);

  let hasStudentId = Boolean(
    session.user?.user_metadata?.student_id_url || (session.user as any)?.student_id_url
  );

  const isChmsu = session.user?.user_metadata?.email_type === "chmsu";
  let activeSession = session;

  if (!isChmsu && !hasStudentId && hasCachedId && session.user?.id) {
    try {
      if (effectiveFront) {
        await uploadStudentIdFile(session.user.id, effectiveFront, "front");
        hasStudentId = true;
      }
      if (effectiveBack) {
        await uploadStudentIdFile(session.user.id, effectiveBack, "back");
      }
      const updated = await authApi.getSession(activeSession.accessToken!);
      activeSession = updated;
    } catch (uploadErr) {
      console.warn("[oauthPostLogin] Cached student ID upload warning:", uploadErr);
    }
  }

  if (hasStudentId || hasCachedId) {
    await saveMobileRegisterCache({
      step: 2,
      showOtpView: false,
      studentIdFrontUri: effectiveFront,
      studentIdBackUri: effectiveBack,
    });
  }

  const target = resolveOAuthNavigationTarget(activeSession, {
    hasStudentId,
    hasCachedId,
    cachedFrontUri: effectiveFront,
    cachedBackUri: effectiveBack,
  });

  return { session: activeSession, target };
}

export function navigateAfterOAuth(
  router: Router,
  target: OAuthNavigationTarget,
  opts?: { alreadyOnRegister?: boolean }
): void {
  switch (target.kind) {
    case "tabs":
      router.replace("/(tabs)");
      break;
    case "pending-approval":
      router.replace("/pages/pending-approval" as any);
      break;
    case "id-upload":
      router.replace({
        pathname: "/pages/id-upload" as any,
        params: { emailType: "external" },
      });
      break;
    case "register-step-2":
      if (opts?.alreadyOnRegister) {
        return;
      }
      router.replace({
        pathname: "/pages/register" as any,
        params: {
          startStep: "2",
          studentIdFrontUri: target.studentIdFrontUri,
          studentIdBackUri: target.studentIdBackUri,
        },
      });
      break;
  }
}
