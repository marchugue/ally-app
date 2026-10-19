import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
  Image,
  Keyboard,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  BackHandler,
  StyleSheet,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  GraduationCap,
  Sparkles,
  FileText,
  Plus,
  X,
  ChevronDown,
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
import {
  getMobileRegisterCache,
  saveMobileRegisterCache,
  clearMobileRegisterCache,
} from "@/lib/registerCache";
import { updateMyProfile } from "@/lib/api/profiles";
import { getPresetAvatars, PresetAvatarRow } from "@/lib/api/media";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/Button";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { useKeyboard } from "@/hooks/useKeyboard";
import Input from "@/components/buttons/button";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GREEN = "#1A6B3C";

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

Official Terms on Website: https://ally-jis.com/terms`;

const PRIVACY_TEXT = `Privacy Policy for Ally-jis:

1. Data Collection: We collect basic profile details (username, institutional email, course, year level, profile avatar, and bio) and interest selections.
2. Purpose: Your data is used exclusively to calculate peer match scores and facilitate campus connections.
3. Data Safety: We never sell or share your personal data with third-party advertisers. Your information stays inside the CHMSU community.
4. Account Rights: You can edit your profile details or request account deletion at any time.

Official Policy on Website: https://ally-jis.com/privacy`;

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  department: string;
  course: string;
  yearLevel: string;
  organizations: string[];
  interests: string[];
  avatar: string;
  bio: string;
}

type CredentialStep = "username" | "email" | "password";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 6, marginLeft: 4 }}>{msg}</Text>;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user, signUp, completeLogin, accessToken, refreshSession, updateUserMetadata } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  // Overall onboarding step: 1 (Credentials), 2 (Academic), 3 (Interests), 4 (Avatar & Bio)
  const [step, setStep] = useState(() => {
    const startStep = Number(params.startStep);
    return startStep >= 2 && startStep <= 4 ? startStep : 1;
  });

  // Credential sub-step for Step 1: username -> email -> password
  const [credStep, setCredStep] = useState<CredentialStep>(() => {
    if (params.subStep === "password") return "password";
    if (params.subStep === "email" || params.editEmail === "true") return "email";
    return "username";
  });

  // Scroll to top on step or credStep change
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, credStep]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(null);
  const [lastModalContent, setLastModalContent] = useState<"terms" | "privacy">("terms");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [touched, setTouched] = useState(false);

  // Email type & Student ID state
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
    if (params.subStep === "password") {
      setCredStep("password");
    } else if (params.subStep === "email" || params.editEmail === "true") {
      setCredStep("email");
    }
  }, [params.emailType, params.studentIdFrontUri, params.studentIdBackUri, params.email, params.username, params.subStep, params.editEmail]);

  // Auto-focus input when transitioning credential sub-steps
  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => {
        if (credStep === "username") usernameInputRef.current?.focus();
        else if (credStep === "email") emailInputRef.current?.focus();
        else if (credStep === "password") passwordInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step, credStep]);

  // Sync existing user metadata into form if user arrived from incomplete profile guard
  useEffect(() => {
    if (user?.user_metadata) {
      const meta = user.user_metadata;
      setForm((prev) => ({
        ...prev,
        username: prev.username || (meta.username as string) || (meta.full_name as string) || "",
        email: prev.email || user.email || "",
        department: prev.department || (meta.department as string) || "",
        course: prev.course || (meta.course as string) || "",
        yearLevel: prev.yearLevel || (meta.year_level as string) || "",
        bio: prev.bio || (meta.bio as string) || "",
        avatar: prev.avatar && prev.avatar !== "😊" ? prev.avatar : ((meta.avatar_url as string) || prev.avatar || "😊"),
        interests: prev.interests.length > 0 ? prev.interests : (Array.isArray(meta.interests) ? (meta.interests as string[]) : []),
        organizations: prev.organizations.length > 0 ? prev.organizations : (Array.isArray(meta.organizations) ? (meta.organizations as string[]) : []),
      }));
    }
  }, [user]);

  // Custom interests
  const [customInterest, setCustomInterest] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Picker modals
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);

  // Keyboard visibility
  const { isKeyboardVisible } = useKeyboard();

  // Input refs for auto-focus
  const usernameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const [presetAvatars, setPresetAvatars] = useState<PresetAvatarRow[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [avatarTab, setAvatarTab] = useState<"presets" | "emojis">("presets");

  const [form, setForm] = useState<FormData>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    course: "",
    yearLevel: "",
    organizations: [],
    interests: [],
    avatar: "😊",
    bio: "",
  });

  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const pendingUserIdRef = useRef<string | null>(null);
  const isVerifiedRef = useRef<boolean>(false);
  const formEmailRef = useRef<string>("");

  useEffect(() => {
    pendingUserIdRef.current = registeredUserId;
  }, [registeredUserId]);

  useEffect(() => {
    formEmailRef.current = form.email.trim().toLowerCase();
  }, [form.email]);

  // Unified back navigation action for phone back button & UI back button
  const handleBack = () => {
    // 1. Modals
    if (activeModal !== null) {
      setActiveModal(null);
      return true;
    }
    if (showDeptPicker) {
      setShowDeptPicker(false);
      return true;
    }
    if (showCoursePicker) {
      setShowCoursePicker(false);
      return true;
    }
    if (showCustomInput) {
      setShowCustomInput(false);
      return true;
    }

    // 2. Step 1 Credential sub-steps
    if (step === 1) {
      if (credStep === "password") {
        setCredStep("email");
        setSubmitError("");
        return true;
      }
      if (credStep === "email") {
        setCredStep("username");
        setSubmitError("");
        return true;
      }
      // Username step back returns to email type selection
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/pages/select-email" as any);
      }
      return true;
    }

    // 3. Multi-steps (Step 2, 3, 4)
    if (step > 1) {
      const minStep = Number(params.startStep) >= 2 ? Number(params.startStep) : 1;
      if (step > minStep) {
        setStep((s) => s - 1);
        setSubmitError("");
        return true;
      }
      return false;
    }

    return true;
  };

  // Intercept Android hardware & gesture back navigation
  useEffect(() => {
    const onBackPress = () => {
      const handled = handleBack();
      return handled !== false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [
    activeModal,
    showDeptPicker,
    showCoursePicker,
    showCustomInput,
    step,
    credStep,
    params.startStep,
  ]);

  // Restore cached verification process and form data on mount
  useEffect(() => {
    if (params.startStep) return;

    getMobileRegisterCache().then(async (cached) => {
      if (!cached) return;

      if (cached.showOtpView && cached.registeredUserId) {
        try {
          const status = await authApi.getOtpStatus(cached.registeredUserId);
          if (status.verified) {
            setStep(cached.step > 1 ? cached.step : 2);
            if (cached.form) setForm((prev) => ({ ...prev, ...cached.form }));
          } else if (status.exists) {
            // Pending verification: navigate to verify-otp page
            router.replace({
              pathname: "/pages/verify-otp" as any,
              params: {
                userId: cached.registeredUserId,
                email: cached.form?.email || "",
              },
            });
          }
        } catch {}
      } else {
        if (cached.emailType && !params.emailType) setEmailType(cached.emailType);
        if (cached.step && cached.step >= 1 && !params.startStep) setStep(cached.step);
        if (cached.form) setForm((prev) => ({ ...prev, ...cached.form }));
        if (cached.studentIdFrontUri && !params.studentIdFrontUri) setStudentIdUri(cached.studentIdFrontUri);
        if (cached.studentIdBackUri && !params.studentIdBackUri) setStudentIdBackUri(cached.studentIdBackUri);
        if (cached.avatarTab) setAvatarTab(cached.avatarTab);
        if (cached.agreedToTerms !== undefined) setAgreedToTerms(cached.agreedToTerms);
      }
    }).catch(() => {});
  }, []);

  // Persist form & verification state to cache
  useEffect(() => {
    if (isDone) return;
    saveMobileRegisterCache({
      emailType,
      step,
      registeredUserId,
      showOtpView: false,
      otpDigits: [],
      form,
      studentIdFrontUri: studentIdUri,
      studentIdBackUri,
      avatarTab,
      agreedToTerms,
    });
  }, [
    emailType,
    step,
    registeredUserId,
    form,
    studentIdUri,
    studentIdBackUri,
    avatarTab,
    agreedToTerms,
    isDone,
  ]);

  // Load admin-curated preset avatars
  useEffect(() => {
    let isMounted = true;
    setIsLoadingPresets(true);
    getPresetAvatars()
      .then((res) => {
        if (isMounted) {
          if (res?.avatars && res.avatars.length > 0) {
            setPresetAvatars(res.avatars);
          } else {
            setAvatarTab("emojis");
          }
        }
      })
      .catch((err) => {
        console.warn("[register] Failed to load preset avatars:", err?.message || err);
        if (isMounted) {
          setAvatarTab("emojis");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingPresets(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    department?: string;
    course?: string;
    yearLevel?: string;
    interests?: string;
  }>({});

  const set = (key: keyof FormData, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const knownCategories = Object.values(INTERESTS_BY_CATEGORY).flat();
  const customInterests = form.interests.filter(i => !knownCategories.includes(i));
  const availableCourses = form.department ? DEPARTMENTS[form.department] || [] : [];

  // Realtime live validation messages
  const usernameError =
    touched && form.username.trim().length > 0
      ? validateUsername(form.username)
      : null;

  const emailError =
    touched && form.email.trim().length > 0
      ? validateEmail(form.email, emailType)
      : null;

  const passwordError =
    touched && form.password.trim().length > 0
      ? validatePass(form.password)
      : null;

  const confirmPasswordError =
    touched && form.confirmPassword.trim().length > 0
      ? form.confirmPassword !== form.password
        ? 'Passwords do not match.'
        : null
      : null;

  // ── Step 1: Credential Navigation (Username -> Email -> Password) ──────────

  const handleContinueCredentials = async () => {
    setSubmitError("");

    if (credStep === "username") {
      const uErr = validateUsername(form.username);
      if (uErr) {
        setTouched(true);
        setErrors((prev) => ({ ...prev, username: uErr }));
        return;
      }
      setErrors((prev) => ({ ...prev, username: undefined }));
      setCredStep("email");
      return;
    }

    if (credStep === "email") {
      const eErr = validateEmail(form.email, emailType);
      if (eErr) {
        setTouched(true);
        setErrors((prev) => ({ ...prev, email: eErr }));
        return;
      }
      setErrors((prev) => ({ ...prev, email: undefined }));
      setCredStep("password");
      return;
    }

    if (credStep === "password") {
      const pErr = validatePass(form.password);
      const cErr = !form.confirmPassword
        ? "Please confirm your password."
        : form.confirmPassword !== form.password
        ? "Passwords do not match."
        : null;

      if (pErr || cErr) {
        setTouched(true);
        setErrors((prev) => ({
          ...prev,
          password: pErr || undefined,
          confirmPassword: cErr || undefined,
        }));
        return;
      }
      setErrors((prev) => ({
        ...prev,
        password: undefined,
        confirmPassword: undefined,
      }));

      // External email: navigate to Student Verification (id-upload)
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

      // CHMSU email: sign up immediately and navigate to verify-otp
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
        pendingUserIdRef.current = result.userId;
        isVerifiedRef.current = false;
        formEmailRef.current = form.email.trim().toLowerCase();

        router.push({
          pathname: "/pages/verify-otp" as any,
          params: {
            userId: result.userId,
            email: form.email,
          },
        });
      } catch (err: any) {
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : err?.message || "Registration failed. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // ── Step 2: Academic Navigation ───────────────────────────────────────────

  const handleNextAcademic = () => {
    const dErr = validateDepartment(form.department);
    const cErr = validateCourse(form.course);
    const yErr = validateYearLevel(form.yearLevel);
    if (dErr || cErr || yErr) {
      setTouched(true);
      setErrors({
        department: dErr || undefined,
        course: cErr || undefined,
        yearLevel: yErr || undefined,
      });
      return;
    }
    setErrors({});
    setStep(3);
  };

  // ── Step 3: Interests Navigation ──────────────────────────────────────────

  const handleNextInterests = () => {
    const iErr = validateInterests(form.interests);
    if (iErr) {
      setTouched(true);
      setErrors({ interests: iErr });
      return;
    }
    setErrors({});
    setStep(4);
  };

  // ── Step 4: Submit Profile ────────────────────────────────────────────────

  const handleNextAvatar = async () => {
    if (!agreedToTerms) {
      setTermsError("You must agree to the Terms & Conditions to continue.");
      return;
    }
    await handleSubmit();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      if (accessToken) {
        const finalUsername = (
          form.username.trim() ||
          (user?.user_metadata?.username as string) ||
          (user?.user_metadata?.full_name as string) ||
          ""
        ).toLowerCase();

        await updateMyProfile(
          {
            username: finalUsername,
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

        await updateUserMetadata({
          onboarding_complete: true,
          username: finalUsername,
          bio: form.bio,
          avatar_url: form.avatar,
          department: form.department,
          course: form.course,
          year_level: form.yearLevel,
          interests: form.interests,
          organizations: form.organizations,
        });

        void refreshSession();
      }
      setIsDone(true);
      clearMobileRegisterCache();
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

  // Titles and Subtitles matching select-email style
  const getHeaderInfo = () => {
    if (step === 1) {
      if (credStep === "username") {
        return {
          title: "Choose a username",
          subtitle: "This will be your unique campus handle on Ally-jis.",
        };
      }
      if (credStep === "email") {
        return {
          title: emailType === "chmsu" ? "Enter your university email" : "Enter your email address",
          subtitle: emailType === "chmsu"
            ? "We'll send a 6-digit verification code to verify your campus identity."
            : "Enter your active email to receive your verification code.",
        };
      }
      return {
        title: "Create a password",
        subtitle: "Choose a strong password with at least 8 characters.",
      };
    }
    if (step === 2) {
      return {
        title: "Academic Details",
        subtitle: "Select your department, degree program, and year level.",
      };
    }
    if (step === 3) {
      return {
        title: "Your Interests",
        subtitle: "Pick topics you enjoy to help discover like-minded peers.",
      };
    }
    return {
      title: "Profile & Bio",
      subtitle: "Personalize your avatar and write a short intro for your peers.",
    };
  };

  const { title: currentTitle, subtitle: currentSubtitle } = getHeaderInfo();

  // ── Done Screen ────────────────────────────────────────────────────────────

  if (isDone) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
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

  // ── Main Layout ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Bar with back arrow (fixed at the top) */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={14}
          style={styles.iconBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={GREEN} />
        </Pressable>
      </View>

      <KeyboardHugView style={{ flex: 1 }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 620, alignSelf: "center" }}>

          {/* ── STEP 1: CREDENTIALS (Username -> Email -> Password separated) ── */}
          {step === 1 && (
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, backgroundColor: "#FFFFFF" }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "space-between",
                paddingHorizontal: 24,
                paddingTop: 8,
                paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16),
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Top: Header Text (Label and sub-label styled like select-email) */}
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
                {submitError ? (
                  <View style={{ marginTop: 12, width: "100%" }}>
                    <AlertMessage message={submitError} type="error" />
                  </View>
                ) : null}
              </View>

              {/* Bottom: Input + Continue button stick together */}
              <View style={styles.bottomStickArea}>
                {credStep === "username" && (
                  <View style={{ marginBottom: 14 }}>
                    <Input
                      ref={usernameInputRef}
                      value={form.username}
                      onChangeText={(text) => {
                        setForm((prev) => ({ ...prev, username: text }));
                        if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                      }}
                      onBlur={() => setTouched(true)}
                      error={errors.username || usernameError}
                      placeholder="Username"
                      icon={<User size={17} color={(errors.username || usernameError) ? "#DC2626" : "#9CA3AF"} />}
                      returnKeyType="next"
                      onSubmitEditing={handleContinueCredentials}
                    />
                  </View>
                )}

                {credStep === "email" && (
                  <View style={{ marginBottom: 14 }}>
                    <EmailInput
                      ref={emailInputRef}
                      value={form.email}
                      onChangeText={(text) => {
                        setForm((prev) => ({ ...prev, email: text }));
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      onBlur={() => setTouched(true)}
                      error={errors.email || emailError}
                      placeholder={emailType === "chmsu" ? "yourname@chmsu.edu.ph" : "yourname@gmail.com"}
                      returnKeyType="next"
                      onSubmitEditing={handleContinueCredentials}
                    />
                  </View>
                )}

                {credStep === "password" && (
                  <View style={{ marginBottom: 14, gap: 12 }}>
                    <PasswordInput
                      ref={passwordInputRef}
                      value={form.password}
                      onChangeText={(text) => {
                        setForm((prev) => ({ ...prev, password: text }));
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      onBlur={() => setTouched(true)}
                      error={errors.password || passwordError}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                    />
                    <PasswordInput
                      ref={confirmPasswordInputRef}
                      value={form.confirmPassword}
                      onChangeText={(text) => {
                        setForm((prev) => ({ ...prev, confirmPassword: text }));
                        if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }}
                      onBlur={() => setTouched(true)}
                      error={errors.confirmPassword || confirmPasswordError}
                      placeholder="Confirm your password"
                      showStrength={false}
                      returnKeyType="done"
                      onSubmitEditing={handleContinueCredentials}
                    />
                  </View>
                )}

                {/* Continue button */}
                <Button
                  label={isSubmitting ? "Processing…" : "Continue"}
                  variant="primary"
                  pill
                  size="lg"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={handleContinueCredentials}
                  className="w-full"
                />

                {!isKeyboardVisible && credStep === "username" && (
                  <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 4 }}>
                    <Text style={{ fontSize: 13, color: "#6B7280" }}>Already have an account?</Text>
                    <Pressable onPress={() => router.replace("/pages/login")}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A6B3C" }}>Sign in</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* ── STEPS 2, 3, 4 (Academic, Interests, Avatar & Bio) ── */}
          {step > 1 && (
            <View style={{ flex: 1 }}>
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: "#FFFFFF" }}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingTop: 8,
                  paddingBottom: 24,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {/* Top: Header Text (Label and sub-label styled like select-email) */}
                <View style={styles.headerText}>
                  <Text style={styles.title}>{currentTitle}</Text>
                  <Text style={styles.subtitle}>{currentSubtitle}</Text>
                  {submitError ? (
                    <View style={{ marginTop: 12, width: "100%" }}>
                      <AlertMessage message={submitError} type="error" />
                    </View>
                  ) : null}
                </View>

                {/* ── STEP 2: Academic Details ── */}
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
                  </View>
                )}

                {/* ── STEP 3: Interests ── */}
                {step === 3 && (
                  <View>
                    {Object.entries(INTERESTS_BY_CATEGORY).map(([category, items]) => (
                      <View key={category} style={{ marginBottom: 18 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <View style={{ flex: 1, height: 1, backgroundColor: "#F0EDE8" }} />
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1.5 }}>
                            {category.toUpperCase()}
                          </Text>
                          <View style={{ flex: 1, height: 1, backgroundColor: "#F0EDE8" }} />
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {items.map(item => {
                            const isSelected = form.interests.includes(item);
                            return (
                              <Pressable
                                key={item}
                                onPress={() => toggleInterest(item)}
                                style={{
                                  paddingHorizontal: 14, paddingVertical: 8,
                                  borderRadius: 20, borderWidth: 1.5,
                                  borderColor: isSelected ? "#1A6B3C" : "#E2DED7",
                                  backgroundColor: isSelected ? "#1A6B3C" : "#FFFFFF",
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: "500", color: isSelected ? "#fff" : "#374151" }}>
                                  {item}
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
                )}

                {/* ── STEP 4: Avatar & Bio ── */}
                {step === 4 && (
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <Text style={labelStyle}>Select Avatar</Text>
                      <View style={{ flexDirection: "row", backgroundColor: "#EDE8E1", borderRadius: 12, padding: 3 }}>
                        <Pressable
                          onPress={() => setAvatarTab("presets")}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 9,
                            backgroundColor: avatarTab === "presets" ? "#FFFFFF" : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: avatarTab === "presets" ? "#1A6B3C" : "#6B7280",
                            }}
                          >
                            Presets
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setAvatarTab("emojis")}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 9,
                            backgroundColor: avatarTab === "emojis" ? "#FFFFFF" : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: avatarTab === "emojis" ? "#1A6B3C" : "#6B7280",
                            }}
                          >
                            Emojis
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {avatarTab === "presets" ? (
                      isLoadingPresets ? (
                        <View style={{ height: 68, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginBottom: 22 }}>
                          <ActivityIndicator size="small" color="#1A6B3C" />
                          <Text style={{ fontSize: 12, color: "#6B7280" }}>Loading preset avatars...</Text>
                        </View>
                      ) : presetAvatars.length === 0 ? (
                        <View style={{ backgroundColor: "#F9F8F6", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 22, borderWidth: 1, borderColor: "#E5E1D8" }}>
                          <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center", marginBottom: 8 }}>
                            No preset avatars found.
                          </Text>
                          <TouchableOpacity onPress={() => setAvatarTab("emojis")}>
                            <Text style={{ fontSize: 12, color: "#1A6B3C", fontWeight: "700" }}>
                              Choose an Emoji instead
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
                          <View style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}>
                            {presetAvatars.map((preset) => (
                              <Pressable
                                key={preset.id}
                                onPress={() => set("avatar", preset.url)}
                                style={{
                                  width: 60, height: 60, borderRadius: 30,
                                  alignItems: "center", justifyContent: "center",
                                  borderWidth: 2,
                                  borderColor: form.avatar === preset.url ? "#1A6B3C" : "#E2DED7",
                                  backgroundColor: "#FFFFFF",
                                  transform: [{ scale: form.avatar === preset.url ? 1.08 : 1 }],
                                  overflow: "hidden",
                                }}
                              >
                                <Image source={{ uri: preset.url }} style={{ width: 60, height: 60 }} resizeMode="cover" />
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      )
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
                        <View style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                          {AVATAR_OPTIONS.map(opt => (
                            <Pressable
                              key={opt}
                              onPress={() => set("avatar", opt)}
                              style={{
                                width: 52, height: 52, borderRadius: 26,
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
                    )}

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
                        <UserAvatar avatar={form.avatar} size="lg" />
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

              {/* Fixed Footer for Steps 2, 3, 4 */}
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 10,
                  paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16),
                  borderTopWidth: 1,
                  borderTopColor: "rgba(0,0,0,0.05)",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Button
                  label={
                    isSubmitting
                      ? "Processing…"
                      : step === 4
                      ? "Complete Profile"
                      : "Continue"
                  }
                  variant="primary"
                  pill
                  size="lg"
                  disabled={isSubmitting || (step === 4 && !agreedToTerms)}
                  icon={step === 4 ? <Check size={16} color="#FFFFFF" /> : <ArrowRight size={16} color="#FFFFFF" />}
                  onPress={
                    step === 2
                      ? handleNextAcademic
                      : step === 3
                      ? handleNextInterests
                      : handleNextAvatar
                  }
                  className="w-full"
                />
              </View>
            </View>
          )}

        </View>
      </KeyboardHugView>

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    paddingHorizontal: 20,
    height: 48,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  bottomStickArea: {
    width: "100%",
    marginTop: "auto",
    paddingTop: 16,
  },
});

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
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 10,
};

const errorRowStyle = {
  borderColor: "#FCA5A5",
};

const multilineInputStyle = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1.5,
  borderColor: "#E2DED7",
  borderRadius: 12,
  padding: 12,
  fontSize: 13,
  color: "#111827",
  textAlignVertical: "top" as const,
  minHeight: 100,
};