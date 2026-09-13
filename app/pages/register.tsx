import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  Keyboard,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Sparkles,
  FileText,
  Plus,
  X,
  ChevronDown,
  Users,
} from "lucide-react-native";
import {
  validateUsername,
  validateEmail,
  validatePass,
  validateDepartment,
  validateCourse,
  validateYearLevel,
  validateInterests,
} from "@/lib/validator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, ApiError } from "@/lib/auth/AuthContext";
import * as authApi from "@/lib/api/auth";
import { updateMyProfile } from "@/lib/api/profiles";
import { uploadStudentIdFile } from "@/lib/api/media";
import { DiagonalStripes } from "@/components/DiagonalStripes";
import { SlideIn } from "@/components/SlideIn";
import { Button } from "@/components/Button";
import Input from "@/components/buttons/button";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import LoadingOverlay from "@/components/LoadingOverlay";
import {
  BasicInfoIllustration,
  AcademicIllustration,
  InterestsIllustration,
  AvatarIllustration,
} from "@/components/OnboardingIllustrations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");


// ── Lookup Data ──────────────────────────────────────────────────────────────

const AVATAR_OPTIONS = [
  "😊","😎","🤓","🤔","😴","🥳","👽","👻",
  "🤖","👾","🦊","🐱","🐶","🐼","🐸","🦉",
  "🦄","🦖","🐙","🐡",
];

const DEPARTMENTS: Record<string, string[]> = {
  "College of Engineering": [
    "BS Civil Engineering",
    "BS Electrical Engineering",
    "BS Mechanical Engineering",
  ],
  "College of Arts and Sciences": [
    "BS Biology",
    "BS Mathematics",
    "AB English",
    "AB Communication",
  ],
  "College of Business and Management": [
    "BS Accountancy",
    "BS Business Administration",
    "BS Entrepreneurship",
  ],
  "College of Education": [
    "Bachelor of Elementary Education",
    "Bachelor of Secondary Education",
  ],
  "College of Nursing": ["BS Nursing"],
  "College of Computer Studies": [
    "BS Computer Science",
    "BS Information Technology",
    "BS Information Systems",
  ],
};

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const INTERESTS_BY_CATEGORY: Record<string, string[]> = {
  "Technology": ["Coding", "AI & ML", "Cybersecurity", "Web Dev", "Mobile Dev", "Gaming"],
  "Arts & Culture": ["Photography", "Drawing", "Music", "Film", "Writing", "Theater"],
  "Sports & Fitness": ["Basketball", "Volleyball", "Swimming", "Running", "Gym", "Badminton"],
  "Academic": ["Research", "Debate", "Science", "Math", "History", "Literature"],
  "Lifestyle": ["Cooking", "Travel", "Fashion", "K-Pop", "Anime", "Reading"],
};

const ORGANIZATIONS = [
  "Supreme Student Government",
  "Computer Science Society",
  "Engineering Society",
  "Nursing Students Association",
  "Business Management Society",
  "Red Cross Youth",
  "ROTC",
  "University Chorale",
  "Dance Troupe",
  "Environmental Club",
];

const TERMS_TEXT = `Welcome to Ally-jis!

By using this platform, you agree to comply with our community standards and terms of use:

1. Campus Exclusive: Ally-jis is built exclusively for CHMSU Alijis Campus students.
2. Authenticity: Provide true profile information (department, course, and year level). Impersonation of students or staff is prohibited.
3. Conduct: Treat fellow students with respect. Harassment, bullying, hate speech, or inappropriate media uploads will result in account suspension.
4. Privacy & Safety: Direct messaging requires mutual connection approval.

Official Terms on Website: https://ally-jis.xyz/terms`;

const PRIVACY_TEXT = `Privacy Policy for Ally-jis:

1. Data Collection: We collect basic profile details (username, institutional email, course, year level, profile avatar, and bio) and interest selections.
2. Purpose: Your data is used exclusively to calculate peer match scores and facilitate campus connections.
3. Data Safety: We never sell or share your personal data with third-party advertisers. Your information stays inside the CHMSU community.
4. Account Rights: You can edit your profile details or request account deletion at any time.

Official Policy on Website: https://ally-jis.xyz/privacy`;

const STEPS = [
  { num: 1, label: "Basic Info",    icon: User,          hint: "Your identity on the platform" },
  { num: 2, label: "Academic",      icon: GraduationCap, hint: "Your course & year at CHMSU" },
  { num: 3, label: "Interests",     icon: Sparkles,      hint: "Powers your matches!" },
  { num: 4, label: "Avatar & Bio",  icon: FileText,      hint: "Pick your emoji & intro" },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  username: string;
  email: string;
  password: string;
  department: string;
  course: string;
  yearLevel: string;
  organizations: string[];
  interests: string[];
  avatar: string;
  bio: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 6, marginLeft: 4 }}>{msg}</Text>;
}

// ── Step illustration selector ────────────────────────────────────────────────

const STEP_BLOB_COLORS = ["#EDE9FE", "#D1FAE5", "#FEF3C7", "#FCE7F3"];

function StepIllustration({ step }: { step: number }) {
  const size = Math.min(SCREEN_WIDTH * 0.42, 170);
  switch (step) {
    case 1: return <BasicInfoIllustration size={size} />;
    case 2: return <AcademicIllustration size={size} />;
    case 3: return <InterestsIllustration size={size} />;
    case 4: return <AvatarIllustration size={size} />;
    default: return <BasicInfoIllustration size={size} />;
  }
}


// ── Main Component ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { signUp, completeLogin, accessToken } = useAuth();
  const [step, setStep] = useState(() => {
    // If redirected from the incomplete-profile guard, start at the specified step.
    const startStep = Number(params.startStep);
    return startStep >= 2 && startStep <= 4 ? startStep : 1;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(null);
  const [lastModalContent, setLastModalContent] = useState<"terms" | "privacy">("terms");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [Touched, setTouched] = useState(false);
  
  // Email type & Student ID state (from params or default)
  const [emailType, setEmailType] = useState<"chmsu" | "external">(
    (params.emailType as "chmsu" | "external") || "chmsu"
  );
  const [studentIdUri, setStudentIdUri] = useState<string | null>(
    (params.studentIdFrontUri as string) || null
  );
  const [studentIdBackUri, setStudentIdBackUri] = useState<string | null>(
    (params.studentIdBackUri as string) || null
  );

  useEffect(() => {
    if (params.emailType) {
      setEmailType(params.emailType as "chmsu" | "external");
    }
    if (params.studentIdFrontUri) {
      setStudentIdUri(params.studentIdFrontUri as string);
    }
    if (params.studentIdBackUri) {
      setStudentIdBackUri(params.studentIdBackUri as string);
    }
    if (params.email || params.username) {
      setForm((prev) => ({
        ...prev,
        email: (params.email as string) || prev.email,
        username: (params.username as string) || prev.username,
      }));
    }
  }, [params.emailType, params.studentIdFrontUri, params.studentIdBackUri, params.email, params.username]);

  // custom interests
  const [customInterest, setCustomInterest] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // OTP State for Step 1
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [showOtpView, setShowOtpView] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // dept picker modal
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);

  // Keyboard height & visibility for hugging the action button directly to keyboard top
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      if (Platform.OS === "android") {
        setKeyboardHeight(e.endCoordinates.height);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [form, setForm] = useState<FormData>({
    username: "",
    email: "",
    password: "",
    department: "",
    course: "",
    yearLevel: "",
    organizations: [],
    interests: [],
    avatar: "😊",
    bio: "",
  });

  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    department?: string;
    course?: string;
    yearLevel?: string;
    interests?: string;
  }>({});

  const set = (key: keyof FormData, val: any) => setForm(prev => ({ ...prev, [key]: val }));


  const knownCategories = Object.values(INTERESTS_BY_CATEGORY).flat();
  const customInterests = form.interests.filter(i => !knownCategories.includes(i));

  const availableCourses = form.department ? DEPARTMENTS[form.department] || [] : [];

  const StepIcon = STEPS[step - 1].icon;

  // Realtime live validation messages
  const usernameError =
    Touched && form.username.trim().length > 0
      ? validateUsername(form.username)
      : null;

  const emailError =
    Touched && form.email.trim().length > 0
      ? validateEmail(form.email, emailType)
      : null;

  const passwordError =
    Touched && form.password.trim().length > 0
      ? validatePass(form.password)
      : null;

  const departmentError =
    Touched
      ? validateDepartment(form.department)
      : null;

  const courseError =
    Touched
      ? validateCourse(form.course)
      : null;

  const yearLevelError =
    Touched
      ? validateYearLevel(form.yearLevel)
      : null;

  function validate(): boolean {
    const errs: typeof errors = {};

    if (step === 1) {
      const uErr = validateUsername(form.username);
      if (uErr) errs.username = uErr;

      const eErr = validateEmail(form.email, emailType);
      if (eErr) errs.email = eErr;

      const pErr = validatePass(form.password);
      if (pErr) errs.password = pErr;
    }

    if (step === 2) {
      const dErr = validateDepartment(form.department);
      if (dErr) errs.department = dErr;

      const cErr = validateCourse(form.course);
      if (cErr) errs.course = cErr;

      const yErr = validateYearLevel(form.yearLevel);
      if (yErr) errs.yearLevel = yErr;
    }

    if (step === 3) {
      const iErr = validateInterests(form.interests);
      if (iErr) errs.interests = iErr;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation & Verification ───────────────────────────────────────────────

  const handleNext = async () => {
    if (!validate()) return;
    setSubmitError("");

    if (step === 1) {
      if (showOtpView) {
        const code = otpDigits.join("");
        if (code.length < 6) {
          setOtpError("Please enter the full 6-digit verification code.");
          return;
        }
        await handleVerifyOtpInStep1(code);
        return;
      }

      // External email: navigate to Student Verification page (id-upload).
      // Account creation happens in id-upload-success after both scans.
      if (emailType === "external") {
        router.push({
          pathname: "/pages/id-upload" as any,
          params: {
            emailType,
            email: form.email,
            username: form.username,
            password: form.password,
          },
        });
        return;
      }

      // CHMSU email: create account immediately and show OTP inline
      setIsSubmitting(true);
      try {
        const result = await signUp({
          email: form.email,
          password: form.password,
          username: form.username.toLowerCase(),
          email_type: emailType,
          interests: [],
          organizations: [],
        });
        setRegisteredUserId(result.userId);
        setShowOtpView(true);
      } catch (err: any) {
        setSubmitError(err instanceof ApiError ? err.message : err?.message || "Registration failed.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (step === 4) {
      if (!agreedToTerms) {
        setTermsError("You must agree to the Terms & Conditions to continue.");
        return;
      }
      await handleSubmit();
      return;
    }
    setStep(s => s + 1);
  };

  const handleVerifyOtpInStep1 = async (code: string) => {
    if (!registeredUserId) return;
    setIsVerifyingOtp(true);
    setOtpError("");
    try {
      const session = await authApi.verifyOtp(registeredUserId, code);
      await completeLogin(session);
      setShowOtpView(false);
      setStep(2);
    } catch (err: any) {
      setOtpError(err?.message || "Invalid verification code. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtpInStep1 = async () => {
    if (!registeredUserId || isResendingOtp || resendCooldown > 0) return;
    setIsResendingOtp(true);
    setOtpError("");
    try {
      await authApi.resendOtp(registeredUserId);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setOtpError(err?.message || "Could not resend code.");
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleBack = () => {
    if (step === 1 && showOtpView) {
      // Hide OTP view but don't navigate away — handleCancelRegistration does the actual rollback
      handleCancelRegistration();
      return;
    }
    if (step > 1) {
      // If user was redirected here to complete an incomplete profile,
      // don't go below the step they started at.
      const minStep = Number(params.startStep) >= 2 ? Number(params.startStep) : 1;
      if (step > minStep) {
        setStep(s => s - 1);
        setSubmitError("");
      }
      // If already at the minimum step (e.g. step 2 for resume flow), do nothing —
      // the user can't go back to Step 1 since their account already exists.
    } else {
      // Step 1 back returns to email type selection
      router.replace("/pages/select-email" as any);
    }
  };

  /**
   * Rolls back the pending (unverified) account when the user goes back from the
   * OTP screen. Fires the DELETE /auth/register/cancel endpoint then resets all
   * Step 1 OTP state so the user can retry with the same or a different email.
   * Resilient: always resets local state even if the server call fails.
   */
  const handleCancelRegistration = async () => {
    const prevUserId = registeredUserId;
    // Reset OTP view state immediately so the user sees the form again
    setShowOtpView(false);
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpError("");
    setRegisteredUserId(null);

    if (prevUserId) {
      try {
        await authApi.cancelRegistration(prevUserId);
      } catch (err: any) {
        // Silently ignore — the user is already back on the form.
        // The pending account will eventually be cleaned up or they can
        // retry with a different email.
        console.warn('[register] cancelRegistration error (non-blocking):', err?.message);
      }
    }
  };

  // ── Submit Profile (Step 4) ───────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (accessToken) {
        await updateMyProfile(
          {
            username: form.username.toLowerCase(),
            bio: form.bio,
            avatar_url: form.avatar,
            department: form.department,
            course: form.course,
            year_level: form.yearLevel,
            interests: form.interests,
            organizations: form.organizations,
          },
          accessToken
        );
      }
      setIsDone(true);
    } catch (err: any) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not save profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live-validates interests
  const updateInterests = (updated: string[]) => {
    setForm(f => ({ ...f, interests: updated }));
    setErrors(e => ({ ...e, interests: validateInterests(updated) || undefined }));
  };

  const toggleInterest = (label: string) => {
    updateInterests(
      form.interests.includes(label)
        ? form.interests.filter(i => i !== label)
        : [...form.interests, label]
    );
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (!trimmed) return;
    if (form.interests.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
      setCustomInterest("");
      return;
    }
    updateInterests([...form.interests, trimmed]);
    setCustomInterest("");
  };

  // ── Done screen ────────────────────────────────────────────────────────────

  if (isDone) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FAF8F5",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        <StatusBar barStyle="dark-content" />
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: "#1A6B3C15",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Check size={36} color="#1A6B3C" />
        </View>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: "#111827",
            textAlign: "center",
            letterSpacing: -0.5,
          }}
        >
          Welcome to Ally-jis! 🎉
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "#6B7280",
            textAlign: "center",
            marginTop: 8,
            lineHeight: 20,
          }}
        >
          Your account and profile are ready. Start exploring campus connections right away!
        </Text>

        <View style={{ width: "100%", marginTop: 32 }}>
          <Button
            label="Get Started"
            variant="primary"
            pill
            size="lg"
            onPress={() => router.replace("/(tabs)")}
          />
        </View>
      </View>
    );
  }

  // ── Form view ──────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1 }}>

          {/* ── Illustrated Step Header ── */}
          <View style={{
            alignItems: "center",
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: 12,
            backgroundColor: "#FFFFFF",
          }}>
            {/* Back button row */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              paddingHorizontal: 20,
              marginBottom: 8,
            }}>
              <Pressable
                onPress={handleBack}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: "#F9FAFB",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowLeft size={20} color="#1A6B3C" />
              </Pressable>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8 }}>
                STEP {step} OF {STEPS.length}
              </Text>
              <View style={{ width: 38 }} />
            </View>

            {/* Illustration blob */}
            <StepIllustration step={step} />

            {/* Title + subtitle */}
            <Text style={{
              fontSize: 22,
              fontWeight: "800",
              color: "#111827",
              textAlign: "center",
              marginTop: 14,
              letterSpacing: -0.5,
            }}>
              {STEPS[step - 1].label}
            </Text>
            <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4 }}>
              {STEPS[step - 1].hint}
            </Text>

            {/* Progress dots */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
              {STEPS.map(({ num }) => (
                <View
                  key={num}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    width: num === step ? 22 : 8,
                    backgroundColor: step >= num ? "#1A6B3C" : "#E5E7EB",
                  }}
                />
              ))}
            </View>

            {submitError ? (
              <View style={{ marginTop: 10, width: "100%", paddingHorizontal: 20 }}>
                <AlertMessage message={submitError} type="error" />
              </View>
            ) : null}
          </View>

          {/* ── Scrollable Content ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ backgroundColor: "#F9FAFB" }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
          >
            {/* ── STEP 1: Basic Info & Email Type & Inline OTP ── */}
            {step === 1 && (
              showOtpView ? (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: "#1A6B3C15", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Mail size={26} color="#1A6B3C" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "center" }}>Verify your email</Text>
                  <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4, paddingHorizontal: 16 }}>
                    We sent a 6-digit verification code to{" "}
                    <Text style={{ fontWeight: "700", color: "#111827" }}>{form.email}</Text>
                  </Text>

                  {/* 6 OTP Inputs */}
                  <View style={{ flexDirection: "row", gap: 8, marginVertical: 20, justifyContent: "center" }}>
                    {otpDigits.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        value={digit}
                        onChangeText={(text) => {
                          const val = text.replace(/[^0-9]/g, "");
                          const updated = [...otpDigits];
                          updated[idx] = val.slice(-1);
                          setOtpDigits(updated);
                        }}
                        keyboardType="number-pad"
                        maxLength={1}
                        style={{
                          width: 44,
                          height: 52,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: digit ? "#1A6B3C" : "#E5E7EB",
                          backgroundColor: digit ? "#F0FDF4" : "#F9FAFB",
                          textAlign: "center",
                          fontSize: 20,
                          fontWeight: "700",
                          color: digit ? "#1A6B3C" : "#111827",
                        }}
                      />
                    ))}
                  </View>

                  {otpError ? (
                    <View style={{ width: "100%", marginBottom: 12 }}>
                      <AlertMessage message={otpError} type="error" />
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={handleResendOtpInStep1}
                    disabled={isResendingOtp || resendCooldown > 0}
                    style={{ marginTop: 4, padding: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A6B3C", textAlign: "center" }}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : isResendingOtp ? "Resending..." : "Resend code"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCancelRegistration}
                    style={{ marginTop: 8, padding: 4 }}
                  >
                    <Text style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>← Change email address</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Input
                    value={form.username}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, username: text }))}
                    onBlur={() => setTouched(true)}
                    error={usernameError}
                    placeholder="Username"
                  />

                  <EmailInput
                    value={form.email}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
                    onBlur={() => setTouched(true)}
                    error={emailError}
                    placeholder={emailType === "chmsu" ? "Your@chmsu.edu.ph" : "yourname@gmail.com"}
                  />

                  <PasswordInput
                    value={form.password}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
                    onBlur={() => setTouched(true)}
                    error={passwordError}
                  />
                </View>
              )
            )}

            {/* ── STEP 2: Academic Details & Student Organizations ── */}
            {step === 2 && (
              <View>
                <Pressable
                  onPress={() => setShowDeptPicker(true)}
                  style={[rowInputStyle, { paddingVertical: 14 }, errors.department && errorRowStyle]}
                >
                  <GraduationCap size={17} color="#9CA3AF" />
                  <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, color: form.department ? "#111827" : "#9CA3AF" }}>
                    {form.department || "Select department"}
                  </Text>
                  <ChevronDown size={16} color="#9CA3AF" />
                </Pressable>
                <FieldError msg={errors.department} />

                <Pressable
                  onPress={() => form.department && setShowCoursePicker(true)}
                  style={[
                    rowInputStyle,
                    { paddingVertical: 14, marginTop: 14 },
                    !form.department && { opacity: 0.5 },
                    errors.course && errorRowStyle,
                  ]}
                >
                  <FileText size={17} color="#9CA3AF" />
                  <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, color: form.course ? "#111827" : "#9CA3AF" }}>
                    {form.course || "Select course"}
                  </Text>
                  <ChevronDown size={16} color="#9CA3AF" />
                </Pressable>
                <FieldError msg={errors.course} />

                <Text style={[labelStyle, { marginTop: 22 }]}>Year Level</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {YEAR_LEVELS.map(y => (
                    <Pressable
                      key={y}
                      onPress={() => set("yearLevel", y)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 9,
                        borderRadius: 20, borderWidth: 1.5,
                        borderColor: form.yearLevel === y ? "#1A6B3C" : "#E2DED7",
                        backgroundColor: form.yearLevel === y ? "#1A6B3C" : "#FFFFFF",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: form.yearLevel === y ? "#fff" : "#374151" }}>
                        {y.replace(" Year", "")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <FieldError msg={errors.yearLevel} />

                <Text style={[labelStyle, { marginTop: 24, marginBottom: 8 }]}>
                  Student Organizations <Text style={{ color: "#9CA3AF", fontWeight: "400" }}>(optional)</Text>
                </Text>
                <View style={{ gap: 8 }}>
                  {ORGANIZATIONS.map(org => {
                    const selected = form.organizations.includes(org);
                    return (
                      <Pressable
                        key={org}
                        onPress={() =>
                          set("organizations", selected
                            ? form.organizations.filter(o => o !== org)
                            : [...form.organizations, org])
                        }
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 10,
                          padding: 12, borderRadius: 16, borderWidth: 1.5,
                          borderColor: selected ? "#1A6B3C" : "#E2DED7",
                          backgroundColor: selected ? "#1A6B3C08" : "#FFFFFF",
                        }}
                      >
                        <View style={{
                          width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
                          borderColor: selected ? "#1A6B3C" : "#D1D5DB",
                          backgroundColor: selected ? "#1A6B3C" : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          {selected && <Check size={11} color="#fff" />}
                        </View>
                        <Text style={{ fontSize: 13, color: selected ? "#1A6B3C" : "#374151", fontWeight: selected ? "600" : "400", flex: 1 }}>
                          {org}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── STEP 3: Interests ── */}
            {step === 3 && (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: "#6B7280" }}>
                    {form.interests.length >= 3
                      ? "You're all set!"
                      : `Select ${3 - form.interests.length} more interest${3 - form.interests.length === 1 ? "" : "s"}`}
                  </Text>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                    backgroundColor: form.interests.length >= 3 ? "#1A6B3C12" : "#E8A83820",
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: form.interests.length >= 3 ? "#1A6B3C" : "#E8A838" }}>
                      {form.interests.length} selected
                    </Text>
                  </View>
                </View>

                {errors.interests ? (
                  <View style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                    <Text style={{ color: "#EF4444", fontSize: 12 }}>⚠️ {errors.interests}</Text>
                  </View>
                ) : null}

                <View style={{ gap: 20 }}>
                  {Object.entries(INTERESTS_BY_CATEGORY).map(([category, items]) => (
                    <View key={category}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: "#F0EDE8" }} />
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1.5 }}>
                          {category.toUpperCase()}
                        </Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: "#F0EDE8" }} />
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {items.map(label => {
                          const selected = form.interests.includes(label);
                          return (
                            <Pressable
                              key={label}
                              onPress={() => toggleInterest(label)}
                              style={{
                                paddingHorizontal: 14, paddingVertical: 8,
                                borderRadius: 20, borderWidth: 1.5,
                                borderColor: selected ? "#1A6B3C" : "#E2DED7",
                                backgroundColor: selected ? "#1A6B3C" : "#FFFFFF",
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "500", color: selected ? "#fff" : "#374151" }}>
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}

                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: "#F0EDE8" }} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1.5 }}>OTHERS</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: "#F0EDE8" }} />
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {customInterests.map(interest => (
                        <View
                          key={interest}
                          style={{
                            flexDirection: "row", alignItems: "center", gap: 6,
                            paddingLeft: 12, paddingRight: 8, paddingVertical: 8,
                            borderRadius: 20, borderWidth: 1.5, borderColor: "#1A6B3C",
                            backgroundColor: "#1A6B3C",
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "500", color: "#fff" }}>{interest}</Text>
                          <Pressable onPress={() => updateInterests(form.interests.filter(i => i !== interest))} hitSlop={6}>
                            <X size={12} color="rgba(255,255,255,0.7)" />
                          </Pressable>
                        </View>
                      ))}

                      {!showCustomInput && (
                        <Pressable
                          onPress={() => setShowCustomInput(true)}
                          style={{
                            flexDirection: "row", alignItems: "center", gap: 6,
                            paddingHorizontal: 14, paddingVertical: 8,
                            borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed",
                            borderColor: "#D1D5DB",
                            backgroundColor: "transparent",
                          }}
                        >
                          <Plus size={13} color="#6B7280" />
                          <Text style={{ fontSize: 13, color: "#6B7280" }}>Add your own</Text>
                        </Pressable>
                      )}
                    </View>

                    {showCustomInput && (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TextInput
                          value={customInterest}
                          onChangeText={setCustomInterest}
                          placeholder="e.g. K-pop"
                          placeholderTextColor="#9CA3AF"
                          autoFocus
                          maxLength={30}
                          onSubmitEditing={addCustomInterest}
                          style={[rowInputStyle, { flex: 1, paddingVertical: 10, marginTop: 0 }]}
                        />
                        <Pressable
                          onPress={addCustomInterest}
                          style={{ backgroundColor: "#1A6B3C", borderRadius: 16, paddingHorizontal: 16, justifyContent: "center" }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Add</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setShowCustomInput(false); setCustomInterest(""); }}
                          style={{ backgroundColor: "#F0EDE8", borderRadius: 16, paddingHorizontal: 12, justifyContent: "center" }}
                        >
                          <X size={16} color="#6B7280" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* ── STEP 4: Avatar & Bio ── */}
            {step === 4 && (
              <View>
                <Text style={[labelStyle, { marginBottom: 10 }]}>Select Avatar</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, marginBottom: 22 }}>
                  <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
                    {AVATAR_OPTIONS.map((opt, i) => (
                      <Pressable
                        key={i}
                        onPress={() => set("avatar", opt)}
                        style={{
                          width: 52, height: 52, borderRadius: 16,
                          alignItems: "center", justifyContent: "center",
                          borderWidth: 1.5,
                          borderColor: form.avatar === opt ? "#1A6B3C" : "#E2DED7",
                          backgroundColor: form.avatar === opt ? "#1A6B3C12" : "#FFFFFF",
                          transform: [{ scale: form.avatar === opt ? 1.08 : 1 }],
                        }}
                      >
                        <Text style={{ fontSize: 26 }}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={labelStyle}>
                  Bio <Text style={{ color: "#9CA3AF", fontWeight: "400" }}>(optional)</Text>
                </Text>
                <View style={{ position: "relative", marginTop: 8, marginBottom: 22 }}>
                  <TextInput
                    value={form.bio}
                    onChangeText={v => set("bio", v.slice(0, 250))}
                    placeholder="Tell your future friends a bit about yourself!"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    style={multilineInputStyle}
                  />
                  <Text style={{ position: "absolute", bottom: 10, right: 14, fontSize: 11, color: "#9CA3AF" }}>
                    {form.bio.length}/250
                  </Text>
                </View>

                <View style={{ backgroundColor: "#F7F4EF", borderRadius: 20, padding: 16, marginBottom: 22 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#1A6B3C", marginBottom: 10, letterSpacing: 0.5 }}>
                    PROFILE PREVIEW
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#1A6B3C12", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 26 }}>{form.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                        {form.username || "your_username"}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                        {form.course || "Your Course"} · {form.yearLevel || "Year"}
                      </Text>
                      {form.bio ? (
                        <Text numberOfLines={2} style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                          {form.bio}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={{
                  borderRadius: 20, padding: 14, borderWidth: 1.5,
                  borderColor: termsError ? "#FECACA" : "#E2DED7",
                  backgroundColor: termsError ? "#FEF2F2" : "#FFFFFF",
                }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <Pressable
                      onPress={() => {
                        if (!agreedToTerms) setActiveModal("terms");
                        else { setAgreedToTerms(false); setTermsError(""); }
                      }}
                      style={{
                        width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
                        borderColor: agreedToTerms ? "#1A6B3C" : "#D1D5DB",
                        backgroundColor: agreedToTerms ? "#1A6B3C" : "transparent",
                        alignItems: "center", justifyContent: "center",
                        marginTop: 1,
                      }}
                    >
                      {agreedToTerms && <Check size={11} color="#fff" />}
                    </Pressable>
                    <Text style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 20 }}>
                      I agree to the{" "}
                      <Text onPress={() => setActiveModal("terms")} style={{ color: "#1A6B3C", fontWeight: "700" }}>
                        Terms & Conditions
                      </Text>
                      {" "}and{" "}
                      <Text onPress={() => setActiveModal("privacy")} style={{ color: "#1A6B3C", fontWeight: "700" }}>
                        Privacy Policy
                      </Text>
                      .
                    </Text>
                  </View>
                  {termsError ? (
                    <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 8 }}>{termsError}</Text>
                  ) : null}
                </View>
              </View>
            )}

          </ScrollView>

          {/* ── Fixed Footer (Non-scrollable, hugs keyboard when inputting) ── */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 10,
              paddingBottom: isKeyboardVisible || keyboardHeight > 0 ? 10 : Math.max(insets.bottom + 12, 16),
              borderTopWidth: 1,
              borderTopColor: "rgba(0,0,0,0.05)",
              backgroundColor: "transparent",
            }}
          >
            <Button
              label={
                isSubmitting || isVerifyingOtp
                  ? "Processing…"
                  : (step === 1 && showOtpView)
                  ? "Verify Code"
                  : step === 4
                  ? "Complete Profile"
                  : "Continue"
              }
              variant="primary"
              pill
              size="lg"
              disabled={isSubmitting || isVerifyingOtp || (step === 4 && !agreedToTerms)}
              icon={step === 4 ? <Check size={16} color="#FFFFFF" /> : <ArrowRight size={16} color="#FFFFFF" />}
              onPress={handleNext}
              className="w-full"
            />

            {!isKeyboardVisible && (
              <>
                <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: "#6B7280" }}>Already have an account?</Text>
                  <Pressable onPress={() => router.replace("/pages/login")}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A6B3C" }}>Sign in</Text>
                  </Pressable>
                </View>

                <Text style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 6, lineHeight: 16 }}>
                  For CHMSU Alijis Campus students only
                </Text>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Department picker modal ── */}
      <PickerModal
        visible={showDeptPicker}
        title="Select Department"
        options={Object.keys(DEPARTMENTS)}
        selected={form.department}
        onSelect={v => { set("department", v); set("course", ""); setShowDeptPicker(false); }}
        onClose={() => setShowDeptPicker(false)}
      />

      {/* ── Course picker modal ── */}
      <PickerModal
        visible={showCoursePicker}
        title="Select Course"
        options={availableCourses}
        selected={form.course}
        onSelect={v => { set("course", v); setShowCoursePicker(false); }}
        onClose={() => setShowCoursePicker(false)}
      />

      {/* ── Terms / Privacy modal ── */}
      <LegalModal
        visible={activeModal !== null}
        contentType={activeModal || lastModalContent}
        onAccept={() => {
          setAgreedToTerms(true);
          setTermsError("");
          setActiveModal(null);
        }}
        onClose={() => setActiveModal(null)}
      />
    </View>
  );
}

// ── Modals & Styles ──────────────────────────────────────────────────────────

function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Pressable
      onPress={onClose}
      style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end", zIndex: 100,
      }}
    >
      <Pressable
        onPress={e => e.stopPropagation()}
        style={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, maxHeight: "70%",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>{title}</Text>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={18} color="#9CA3AF" />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map(opt => (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
              }}
            >
              <Text style={{ fontSize: 14, color: selected === opt ? "#1A6B3C" : "#374151", fontWeight: selected === opt ? "700" : "400" }}>
                {opt}
              </Text>
              {selected === opt && <Check size={16} color="#1A6B3C" />}
            </Pressable>
          ))}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

function LegalModal({
  visible,
  contentType,
  onAccept,
  onClose,
}: {
  visible: boolean;
  contentType: "terms" | "privacy";
  onAccept: () => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  const isTerms = contentType === "terms";
  const title = isTerms ? "Terms & Conditions" : "Privacy Policy";
  const text = isTerms ? TERMS_TEXT : PRIVACY_TEXT;

  return (
    <Pressable
      onPress={onClose}
      style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center", alignItems: "center",
        padding: 20, zIndex: 100,
      }}
    >
      <Pressable
        onPress={e => e.stopPropagation()}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 24, padding: 24,
          width: "100%", maxHeight: "80%",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A6B3C" }}>{title}</Text>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: "#374151", lineHeight: 20 }}>{text}</Text>
        </ScrollView>

        <Button
          label="I Agree & Accept"
          variant="primary"
          pill
          size="lg"
          onPress={onAccept}
        />
      </Pressable>
    </Pressable>
  );
}

const labelStyle = {
  fontSize: 13,
  fontWeight: "700" as const,
  color: "#374151",
};

const rowInputStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#FFFFFF",
  borderWidth: 1.5,
  borderColor: "#E2DED7",
  borderRadius: 16,
  paddingHorizontal: 14,
};

const errorRowStyle = {
  borderColor: "#FCA5A5",
};

const multilineInputStyle = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1.5,
  borderColor: "#E2DED7",
  borderRadius: 16,
  padding: 14,
  fontSize: 13,
  color: "#111827",
  textAlignVertical: "top" as const,
  minHeight: 100,
};