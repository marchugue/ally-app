import { useState, useEffect, useRef, useMemo } from "react";
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
  Alert,
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
  FileCheck,
  AlertCircle,
  Search,
  Camera,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import {
  validateUsername,
  validateEmail,
  validatePass,
  validateDepartment,
  validateCourse,
  validateYearLevel,
  validateInterests,
  analyzeEmail,
  EmailAnalysis,
} from "@/lib/validator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, ApiError } from "@/lib/auth/AuthContext";
import * as authApi from "@/lib/api/auth";
import {
  getMobileRegisterCache,
  saveMobileRegisterCache,
  clearMobileRegisterCache,
} from "@/lib/registerCache";
import { updateMyProfile, checkUsernameAvailable } from "@/lib/api/profiles";
import { uploadStudentIdFile, uploadUserAvatar } from "@/lib/api/media";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { ANIMAL_KEYS } from "@/constants/matchOptions";
import { Button } from "@/components/Button";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { useKeyboard } from "@/hooks/useKeyboard";
import Input from "@/components/buttons/button";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import GoogleButton, { OrDivider } from "@/components/GoogleButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GREEN = "#1A6B3C";

// ── Lookup Data Matching Web ──────────────────────────────────────────────────

const DEPARTMENTS = [
  "College of Computer Studies",
  "College of Education",
  "College of Industrial Technology",
  "College of Engineering",
];

const COURSES_BY_DEPT: Record<string, string[]> = {
  "College of Computer Studies": ["Information Technology", "Information System"],
  "College of Education": ["Technical Vocational Teacher Education"],
  "College of Industrial Technology": [
    "Automotive",
    "Architectural Drafting",
    "Computer Technology",
    "Culinary",
    "Electrical",
    "Electronics",
    "Mechanical Technology",
  ],
  "College of Engineering": ["Computer Engineering", "Electronics Engineering"],
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
  "Artisan's Society",
  "Adventist Ministry College and University Students' Excelsior",
  "Automotive Technology Society",
  "CHMSU-A Kabanda",
  "CHMSU-Alijis Performing Arts",
  "Circle of Peer Facilitators",
  "Computer Technology Society",
  "CHMSU Alijis Vocals",
  "CHMSU Python Esports Club",
  "CHMSU University Student Government",
  "CHMSUans Red Cross Youth Council",
  "D' Culinarianz",
  "D' Machinist",
  "Electronics and Communication Technology Society",
  "Future Technical Educators' Society",
  "Information Systems Society",
  "Information Technology Society",
  "Institute of Computer Engineers of the Philippines, Student Edition CHMSU Alijis",
  "Institute of Electronics Engineers of the Philippines-Negros Occidental Student Chapter CHMSU-Alijis",
  "Integrated Institute of Electrical Student Society",
  "Junior Safety Officer of Negros Occidental",
  "New Life Apostolic Campus Ministries",
  "Research Enthusiasts CHMSU-Alijis",
  "Philippine Institute of Cyber Security Professionals' Junior - CHMSU-A",
  "United Seniors Organization",
  "Unsullied Frisbee Club",
  "The Technopacer",
  "Youth Movers' Movement",
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

type AcademicSubStep = "username" | "department" | "course" | "year" | "organizations";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 6, marginLeft: 4 }}>{msg}</Text>;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user, signUp, completeLogin, accessToken, refreshSession, updateUserMetadata, signInWithGoogle } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  // Overall onboarding step: 1 (Credentials), 2 (Academic & Org), 3 (Interests), 4 (Avatar & Bio)
  const [step, setStep] = useState<number>(() => {
    const startStep = Number(params.startStep);
    return startStep >= 2 && startStep <= 4 ? startStep : 1;
  });

  // Step 2 Academic Sub-Step ('username' | 'department' | 'course' | 'year' | 'organizations')
  const [academicSubStep, setAcademicSubStep] = useState<AcademicSubStep>("username");
  const [googleLoading, setGoogleLoading] = useState(false);

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

  // Custom Year Level state
  const [customYearInput, setCustomYearInput] = useState("");
  const [isCustomYear, setIsCustomYear] = useState(false);

  // Step 2 Campus Org Auto Suggestion state
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [isOrgInputActive, setIsOrgInputActive] = useState(false);
  const orgInputRef = useRef<TextInput>(null);

  // Step 3 Interests Category selection
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [customInterest, setCustomInterest] = useState("");

  // Keyboard visibility
  const { isKeyboardVisible } = useKeyboard();

  // Input refs for auto-focus
  const usernameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const [avatarTab, setAvatarTab] = useState<"presets" | "emojis">("presets");
  const [customAvatarUri, setCustomAvatarUri] = useState<string | null>(null);

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
    avatar: "fox",
    bio: "",
  });

  const pickCustomPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to choose a profile picture."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCustomAvatarUri(uri);
        setForm((prev) => ({ ...prev, avatar: uri }));
      }
    } catch (err) {
      console.warn("[pickCustomPhoto] Error:", err);
    }
  };

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

  // Real-time email analysis matching web
  const emailAnalysis: EmailAnalysis = useMemo(() => {
    return analyzeEmail(form.email);
  }, [form.email]);

  useEffect(() => {
    if (emailAnalysis.isChmsu) {
      setEmailType("chmsu");
    } else if (emailAnalysis.isExternal) {
      setEmailType("external");
    }
  }, [emailAnalysis.isChmsu, emailAnalysis.isExternal]);

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
    if (params.startStep) {
      const s = Number(params.startStep);
      if (s >= 2 && s <= 4) setStep(s);
    }
  }, [params.emailType, params.studentIdFrontUri, params.studentIdBackUri, params.email, params.username, params.startStep]);

  // Sync existing user metadata into form if user arrived from incomplete profile guard
  useEffect(() => {
    if (user?.user_metadata) {
      const meta = user.user_metadata;
      setForm((prev) => ({
        ...prev,
        username: prev.username || (meta.username as string) || (meta.full_name ? (meta.full_name as string).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) : ""),
        email: prev.email || user.email || "",
        department: prev.department || (meta.department as string) || "",
        course: prev.course || (meta.course as string) || "",
        yearLevel: prev.yearLevel || (meta.year_level as string) || "",
        bio: prev.bio || (meta.bio as string) || "",
        avatar: prev.avatar && prev.avatar !== "😊" && prev.avatar !== "fox" ? prev.avatar : ((meta.avatar_url as string) || prev.avatar || "fox"),
        interests: prev.interests.length > 0 ? prev.interests : (Array.isArray(meta.interests) ? (meta.interests as string[]) : []),
        organizations: prev.organizations.length > 0 ? prev.organizations : (Array.isArray(meta.organizations) ? (meta.organizations as string[]) : []),
      }));
    }
  }, [user]);

  // Restore cached verification process and form data on mount
  useEffect(() => {
    getMobileRegisterCache().then(async (cached) => {
      if (!cached) return;

      if (cached.showOtpView && cached.registeredUserId && !params.startStep) {
        try {
          const status = await authApi.getOtpStatus(cached.registeredUserId);
          if (status.verified) {
            setStep(cached.step > 1 ? cached.step : 2);
            if (cached.form) setForm((prev) => ({ ...prev, ...cached.form }));
          } else if (status.exists) {
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
        if (params.startStep) {
          const s = Number(params.startStep);
          if (s >= 2 && s <= 4) setStep(s);
        } else if (cached.step && cached.step >= 1) {
          setStep(cached.step);
        }
        if (cached.form) {
          setForm((prev) => ({
            ...prev,
            username: prev.username || cached.form?.username || "",
            email: prev.email || cached.form?.email || "",
            department: prev.department || cached.form?.department || "",
            course: prev.course || cached.form?.course || "",
            yearLevel: prev.yearLevel || cached.form?.yearLevel || "",
            bio: prev.bio || cached.form?.bio || "",
            avatar: prev.avatar && prev.avatar !== "😊" && prev.avatar !== "fox" ? prev.avatar : (cached.form?.avatar || "fox"),
            interests: prev.interests.length > 0 ? prev.interests : (cached.form?.interests || []),
            organizations: prev.organizations.length > 0 ? prev.organizations : (cached.form?.organizations || []),
          }));
        }
        if (cached.studentIdFrontUri && !params.studentIdFrontUri) setStudentIdUri(cached.studentIdFrontUri);
        if (cached.studentIdBackUri && !params.studentIdBackUri) setStudentIdBackUri(cached.studentIdBackUri);
        if (cached.avatarTab) setAvatarTab(cached.avatarTab);
        if (cached.agreedToTerms !== undefined) setAgreedToTerms(cached.agreedToTerms);
      }
    }).catch(() => {});
  }, []);

  // If user is already authenticated (e.g. Google OAuth) and onboarding is incomplete, ensure step is at least 2 and sync cached ID
  useEffect(() => {
    if (user) {
      setStep((prev) => (prev === 1 ? 2 : prev));
      setAcademicSubStep("username");

      if (!user.user_metadata?.student_id_url) {
        getMobileRegisterCache().then((cached) => {
          const front = studentIdUri || cached?.studentIdFrontUri;
          const back = studentIdBackUri || cached?.studentIdBackUri;
          if (front) {
            uploadStudentIdFile(user.id, front, "front").catch((e) =>
              console.warn("[register.tsx] Auto-upload cached front ID error:", e)
            );
          }
          if (back) {
            uploadStudentIdFile(user.id, back, "back").catch((e) =>
              console.warn("[register.tsx] Auto-upload cached back ID error:", e)
            );
          }
        });
      }
    }
  }, [user]);

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

  // Unified Back Navigation mirroring web sub-step history
  const handleBack = () => {
    if (activeModal !== null) {
      setActiveModal(null);
      return true;
    }

    if (step === 4) {
      setStep(3);
      setSubmitError("");
      return true;
    }

    if (step === 3) {
      setStep(2);
      setAcademicSubStep("organizations");
      setSubmitError("");
      return true;
    }

    if (step === 2) {
      if (academicSubStep === "organizations") {
        setAcademicSubStep("year");
        setSubmitError("");
        return true;
      }
      if (academicSubStep === "year") {
        setAcademicSubStep("course");
        setSubmitError("");
        return true;
      }
      if (academicSubStep === "course") {
        setAcademicSubStep("department");
        setSubmitError("");
        return true;
      }
      if (academicSubStep === "department") {
        setAcademicSubStep("username");
        setSubmitError("");
        return true;
      }
      if (academicSubStep === "username") {
        if (user) {
          const isPending = user.user_metadata?.email_type === "external" && !user.user_metadata?.is_approved;
          router.replace(isPending ? ("/pages/pending-approval" as any) : "/(tabs)");
          return true;
        }
        setStep(1);
        setSubmitError("");
        return true;
      }
    }

    if (step === 1) {
      if (user) {
        const isPending = user.user_metadata?.email_type === "external" && !user.user_metadata?.is_approved;
        router.replace(isPending ? ("/pages/pending-approval" as any) : "/(tabs)");
        return true;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/pages/landing" as any);
      }
      return true;
    }

    return true;
  };

  // Intercept Android hardware & gesture back navigation
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [
    activeModal,
    step,
    academicSubStep,
    user,
    params.startStep,
  ]);

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

  const availableCourses = form.department ? COURSES_BY_DEPT[form.department] || [] : [];

  // Matching campus organizations suggestions
  const matchingOrgs = useMemo(() => {
    const trimmed = orgSearchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return ORGANIZATIONS.filter(
      (org) => org.toLowerCase().includes(trimmed) && !form.organizations.includes(org)
    );
  }, [orgSearchQuery, form.organizations]);

  const showCustomOrgAdd = useMemo(() => {
    const trimmed = orgSearchQuery.trim();
    if (!trimmed) return false;
    return !ORGANIZATIONS.some((o) => o.toLowerCase() === trimmed.toLowerCase()) &&
      !form.organizations.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  }, [orgSearchQuery, form.organizations]);

  // Step 3 Displayed Interests
  const displayedInterests = useMemo(() => {
    if (activeCategory === "All") {
      return Array.from(new Set(Object.values(INTERESTS_BY_CATEGORY).flat().concat(form.interests)));
    }
    const catList = INTERESTS_BY_CATEGORY[activeCategory] || [];
    const customInCat = form.interests.filter(
      (i) => !Object.values(INTERESTS_BY_CATEGORY).flat().includes(i)
    );
    return Array.from(new Set([...catList, ...customInCat]));
  }, [activeCategory, form.interests]);

  // Live validation
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
        ? "Passwords do not match."
        : null
      : null;

  // ── Step 1: Google OAuth Registration ─────────────────────────────────────
  const handleGoogleRegister = async () => {
    setSubmitError("");
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogle();
      const isChmsu = session.user?.user_metadata?.email_type === "chmsu";
      const needsOnboarding = !session.user?.user_metadata?.onboarding_complete;
      const hasStudentId = Boolean(session.user?.user_metadata?.student_id_url);

      const cached = await getMobileRegisterCache();
      const effectiveFront = studentIdUri || cached?.studentIdFrontUri || null;
      const effectiveBack = studentIdBackUri || cached?.studentIdBackUri || null;
      const hasCachedId = Boolean(effectiveFront);

      if (isChmsu) {
        if (needsOnboarding) {
          setStep(2);
          setAcademicSubStep("username");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        if (hasCachedId && session.user?.id) {
          if (!hasStudentId && effectiveFront) {
            uploadStudentIdFile(session.user.id, effectiveFront, "front").catch((e) =>
              console.warn("[register.tsx] Auto-upload front ID warning:", e)
            );
          }
          if (effectiveBack) {
            uploadStudentIdFile(session.user.id, effectiveBack, "back").catch((e) =>
              console.warn("[register.tsx] Auto-upload back ID warning:", e)
            );
          }
          await saveMobileRegisterCache({
            step: 2,
            studentIdFrontUri: effectiveFront,
            studentIdBackUri: effectiveBack,
          });

          if (needsOnboarding) {
            setStep(2);
            setAcademicSubStep("username");
          } else if (!session.user?.user_metadata?.is_approved) {
            router.replace("/pages/pending-approval" as any);
          } else {
            router.replace("/(tabs)");
          }
        } else if (!hasStudentId) {
          router.replace({
            pathname: "/pages/id-upload" as any,
            params: { emailType: "external" },
          });
        } else if (needsOnboarding) {
          setStep(2);
          setAcademicSubStep("username");
        } else if (!session.user?.user_metadata?.is_approved) {
          router.replace("/pages/pending-approval" as any);
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes("cancelled")) {
        setSubmitError(err.message || "Google Sign-In failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Step 1: Credentials Submission ────────────────────────────────────────
  const handleContinueCredentials = async () => {
    setSubmitError("");

    const cleanEmail = form.email.trim().toLowerCase();
    const analysis = analyzeEmail(cleanEmail);

    if (analysis.isTypo) {
      setTouched(true);
      setErrors((prev) => ({
        ...prev,
        email: analysis.typoMessage || "Did you mean @chmsu.edu.ph?",
      }));
      return;
    }

    const inferredType = analysis.isChmsu ? "chmsu" : "external";
    setEmailType(inferredType);

    const eErr = validateEmail(cleanEmail, inferredType);
    const pErr = validatePass(form.password);
    const cErr = !form.confirmPassword
      ? "Please confirm your password."
      : form.confirmPassword !== form.password
      ? "Passwords do not match."
      : null;

    if (eErr || pErr || cErr) {
      setTouched(true);
      setErrors((prev) => ({
        ...prev,
        email: eErr || undefined,
        password: pErr || undefined,
        confirmPassword: cErr || undefined,
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const check = await authApi.checkEmailAvailable(cleanEmail);
      if (check && !check.available) {
        setTouched(true);
        setErrors((prev) => ({
          ...prev,
          email: check.message || "An account with this email already exists. Please log in or use a different email.",
        }));
        setIsSubmitting(false);
        return;
      }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("already") || err?.status === 409) {
        setTouched(true);
        setErrors((prev) => ({
          ...prev,
          email: "An account with this email already exists. Please log in or use a different email.",
        }));
        setIsSubmitting(false);
        return;
      }
    }

    const candidateUsername = form.username.trim()
      ? form.username.trim().toLowerCase()
      : (cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15) || "student");
    if (!form.username) {
      setForm((prev) => ({ ...prev, username: candidateUsername }));
    }

    // External email: route to ID upload
    if (inferredType === "external") {
      setIsSubmitting(false);
      router.push({
        pathname: "/pages/id-upload" as any,
        params: {
          emailType: inferredType,
          email: cleanEmail,
          username: candidateUsername,
          password: form.password,
        },
      });
      return;
    }

    // CHMSU email: sign up immediately and navigate to verify-otp
    try {
      const result = await signUp({
        email: cleanEmail,
        password: form.password,
        username: candidateUsername,
        email_type: inferredType,
        interests: [],
        organizations: [],
      });
      setRegisteredUserId(result.userId);
      pendingUserIdRef.current = result.userId;
      isVerifiedRef.current = false;
      formEmailRef.current = cleanEmail;

      router.push({
        pathname: "/pages/verify-otp" as any,
        params: {
          userId: result.userId,
          email: cleanEmail,
        },
      });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err?.message || "Registration failed. Please try again.";
      if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("already registered")) {
        setTouched(true);
        setErrors((prev) => ({
          ...prev,
          email: "An account with this email already exists. Please log in or use a different email.",
        }));
      } else {
        setSubmitError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2 Sub-step: Username Navigation ──────────────────────────────────
  const handleNextFromUsername = async () => {
    const clean = form.username.trim().toLowerCase();
    const uErr = validateUsername(clean);
    if (uErr) {
      setTouched(true);
      setErrors((prev) => ({ ...prev, username: uErr }));
      return;
    }

    try {
      const activeId = user?.id || registeredUserId;
      const res = await checkUsernameAvailable(clean, activeId || undefined);
      if (!res.available) {
        setTouched(true);
        setErrors((prev) => ({
          ...prev,
          username: "That username is already taken. Please choose another.",
        }));
        return;
      }
    } catch {}

    setErrors((prev) => ({ ...prev, username: undefined }));
    setAcademicSubStep("department");
  };

  // ── Step 3: Interests Navigation ──────────────────────────────────────────
  const toggleInterest = (label: string) => {
    const next = form.interests.includes(label)
      ? form.interests.filter((i) => i !== label)
      : [...form.interests, label];
    setForm((f) => ({ ...f, interests: next }));
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (!trimmed) return;
    if (form.interests.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      setCustomInterest("");
      return;
    }
    setForm((f) => ({ ...f, interests: [...f.interests, trimmed] }));
    setCustomInterest("");
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

        let finalAvatarUrl = form.avatar || "fox";

        // Upload custom photo if selected
        if (customAvatarUri) {
          try {
            const uploadRes = await uploadUserAvatar(
              {
                uri: customAvatarUri,
                name: `avatar_${Date.now()}.jpg`,
                type: "image/jpeg",
              },
              accessToken
            );
            if (uploadRes?.url) {
              finalAvatarUrl = uploadRes.url;
            }
          } catch (uploadErr) {
            console.warn("[handleSubmit] Custom avatar upload failed:", uploadErr);
          }
        }

        await updateMyProfile(
          {
            username: finalUsername,
            bio: form.bio,
            avatar_url: finalAvatarUrl,
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
          avatar_url: finalAvatarUrl,
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

  // Titles and Subtitles
  const getHeaderInfo = () => {
    if (step === 1) {
      return {
        title: "Create your account",
        subtitle: "Join the campus community on Ally-jis.",
      };
    }
    if (step === 2) {
      if (academicSubStep === "username") {
        return {
          title: "Choose a username",
          subtitle: "This will be your unique campus handle on Ally-jis.",
        };
      }
      if (academicSubStep === "department") {
        return {
          title: "Academic Department",
          subtitle: "Select the college or department you are enrolled in.",
        };
      }
      if (academicSubStep === "course") {
        return {
          title: "Degree Program",
          subtitle: "Select your course or degree program.",
        };
      }
      if (academicSubStep === "year") {
        return {
          title: "Year Level",
          subtitle: "What year level are you currently in?",
        };
      }
      return {
        title: "Campus Organizations",
        subtitle: "Add student organizations or clubs you are part of (optional).",
      };
    }
    if (step === 3) {
      return {
        title: "Your Interests",
        subtitle: "Pick topics you enjoy to help discover like-minded peers.",
      };
    }
    return {
      title: "Your Profile",
      subtitle: "Review how fellow CHMSU students will see you",
    };
  };

  const { title: currentTitle, subtitle: currentSubtitle } = getHeaderInfo();

  // ── Done Screen ────────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <View style={styles.doneContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.doneIconCircle}>
          <Check size={36} color="#1A6B3C" />
        </View>
        <Text style={styles.doneTitle}>Welcome to Ally-jis! 🎉</Text>
        <Text style={styles.doneSubtitle}>
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

  // ── Main Screen Layout ─────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Bar with back arrow */}
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

          {/* ═════════════════════════════════════════════════════════════════
                STEP 1: CREDENTIALS (Email with Smart Detection, Password)
             ═════════════════════════════════════════════════════════════════ */}
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
              {/* Top: Header Text */}
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
                {submitError ? (
                  <View style={{ marginTop: 12, width: "100%" }}>
                    <AlertMessage message={submitError} type="error" />
                  </View>
                ) : null}
              </View>

              {/* Bottom: Inputs + Continue button stick together */}
              <View style={styles.bottomStickArea}>
                <GoogleButton
                  onPress={handleGoogleRegister}
                  loading={googleLoading}
                  label="Sign up with Google"
                />
                <OrDivider text="OR" />

                {/* Email Input with Smart Badge */}
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.emailBadgeRow}>
                    <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                    {emailAnalysis.isChmsu && (
                      <View style={styles.badgeChmsu}>
                        <GraduationCap size={13} color="#1A6B3C" />
                        <Text style={styles.badgeChmsuText}>CHMSU Institutional Email</Text>
                      </View>
                    )}
                    {emailAnalysis.isExternal && (
                      <View style={styles.badgeExternal}>
                        <FileCheck size={13} color="#D97706" />
                        <Text style={styles.badgeExternalText}>Personal Email</Text>
                      </View>
                    )}
                  </View>

                  <EmailInput
                    ref={emailInputRef}
                    value={form.email}
                    onChangeText={(text) => {
                      setForm((prev) => ({ ...prev, email: text }));
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    onBlur={async () => {
                      setTouched(true);
                      const clean = form.email.trim().toLowerCase();
                      const analysis = analyzeEmail(clean);
                      if (analysis.isTypo) {
                        setErrors((prev) => ({
                          ...prev,
                          email: analysis.typoMessage || "Did you mean @chmsu.edu.ph?",
                        }));
                        return;
                      }
                      if (!clean || validateEmail(clean, emailType)) return;
                      try {
                        const check = await authApi.checkEmailAvailable(clean);
                        if (check && !check.available) {
                          setErrors((prev) => ({
                            ...prev,
                            email: check.message || "An account with this email already exists. Please log in or use a different email.",
                          }));
                        }
                      } catch (err: any) {
                        if (err?.message?.toLowerCase().includes("already") || err?.status === 409) {
                          setErrors((prev) => ({
                            ...prev,
                            email: "An account with this email already exists. Please log in or use a different email.",
                          }));
                        }
                      }
                    }}
                    error={errors.email || emailError}
                    placeholder="yourname@chmsu.edu.ph or name@gmail.com"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />

                  {emailAnalysis.isTypo && emailAnalysis.suggestedEmail && (
                    <TouchableOpacity
                      onPress={() => {
                        setForm((prev) => ({ ...prev, email: emailAnalysis.suggestedEmail! }));
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      style={styles.typoBanner}
                    >
                      <AlertCircle size={14} color="#DC2626" />
                      <Text style={styles.typoBannerText}>
                        Tap to use:{" "}
                        <Text style={{ fontWeight: "700", textDecorationLine: "underline" }}>
                          {emailAnalysis.suggestedEmail}
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Password Fields */}
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

                {!isKeyboardVisible && (
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

          {/* ═════════════════════════════════════════════════════════════════
                STEP 2: SUB-STEP 1: USERNAME (Input sticks to button on bottom)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 2 && academicSubStep === "username" && (
            <View style={styles.stepContainer}>
              {/* Top Header */}
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
              </View>

              {/* Center decorative element */}
              <View style={styles.centeredArea}>
                <View style={styles.usernamePreviewCircle}>
                  <User size={40} color="#1A6B3C" />
                </View>
                <Text style={styles.usernameHandlePreview}>
                  {form.username ? `@${form.username}` : "@your_handle"}
                </Text>
              </View>

              {/* Bottom: Username Input sticking to Continue Button */}
              <View style={[styles.bottomStickArea, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16) }]}>
                <View style={{ marginBottom: 12 }}>
                  <Input
                    ref={usernameInputRef}
                    value={form.username}
                    onChangeText={(text) => {
                      setForm((prev) => ({
                        ...prev,
                        username: text.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                      }));
                      if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    onBlur={() => setTouched(true)}
                    error={errors.username || usernameError}
                    placeholder="Username"
                    icon={<User size={17} color={(errors.username || usernameError) ? "#DC2626" : "#9CA3AF"} />}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleNextFromUsername}
                  />
                </View>

                <Button
                  label="Continue to Academic Details"
                  variant="primary"
                  pill
                  size="lg"
                  disabled={!form.username.trim()}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={handleNextFromUsername}
                  className="w-full"
                />
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════
                STEP 2: SUB-STEP 2: DEPARTMENT (Options in Center, Button on Bottom)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 2 && academicSubStep === "department" && (
            <View style={styles.stepContainer}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
              </View>

              {/* Options in the Center */}
              <View style={styles.centeredArea}>
                <ScrollView
                  style={{ width: "100%" }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.centeredScrollContent}
                >
                  <View style={styles.optionsWrap}>
                    {DEPARTMENTS.map((dept) => {
                      const isSelected = form.department === dept;
                      return (
                        <Pressable
                          key={dept}
                          onPress={() => {
                            setForm((prev) => ({ ...prev, department: dept, course: "" }));
                            setErrors((prev) => ({ ...prev, department: undefined, course: undefined }));
                          }}
                          style={[styles.pillOptionCard, isSelected && styles.pillOptionCardSelected]}
                        >
                          <Text style={[styles.pillOptionText, isSelected && styles.pillOptionTextSelected]}>
                            {dept}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Continue Button on the Bottom */}
              <View style={[styles.bottomStickArea, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
                <Button
                  label="Continue to Degree Program"
                  variant="primary"
                  pill
                  size="lg"
                  disabled={!form.department}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={() => setAcademicSubStep("course")}
                  className="w-full"
                />
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════
                STEP 2: SUB-STEP 3: COURSE (Options in Center, Button on Bottom)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 2 && academicSubStep === "course" && (
            <View style={styles.stepContainer}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
              </View>

              {/* Options in the Center */}
              <View style={styles.centeredArea}>
                <ScrollView
                  style={{ width: "100%" }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.centeredScrollContent}
                >
                  <View style={styles.optionsWrap}>
                    {availableCourses.length === 0 ? (
                      <View style={styles.emptyCourseBox}>
                        <Text style={styles.emptyCourseText}>
                          No degree programs listed. Please go back and select your department.
                        </Text>
                      </View>
                    ) : (
                      availableCourses.map((crs) => {
                        const isSelected = form.course === crs;
                        return (
                          <Pressable
                            key={crs}
                            onPress={() => {
                              setForm((prev) => ({ ...prev, course: crs }));
                              setErrors((prev) => ({ ...prev, course: undefined }));
                            }}
                            style={[styles.pillOptionCard, isSelected && styles.pillOptionCardSelected]}
                          >
                            <Text style={[styles.pillOptionText, isSelected && styles.pillOptionTextSelected]}>
                              {crs}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              </View>

              {/* Continue Button on the Bottom */}
              <View style={[styles.bottomStickArea, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
                <Button
                  label="Continue to Year Level"
                  variant="primary"
                  pill
                  size="lg"
                  disabled={!form.course}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={() => setAcademicSubStep("year")}
                  className="w-full"
                />
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════
                STEP 2: SUB-STEP 4: YEAR LEVEL (Options Center, Others/Input on Bottom)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 2 && academicSubStep === "year" && (
            <View style={styles.stepContainer}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
              </View>

              {/* Options in the Center */}
              <View style={styles.centeredArea}>
                <ScrollView
                  style={{ width: "100%" }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.centeredScrollContent}
                >
                  <View style={styles.optionsWrap}>
                    {YEAR_LEVELS.map((yr) => {
                      const isSelected = !isCustomYear && form.yearLevel === yr;
                      return (
                        <Pressable
                          key={yr}
                          onPress={() => {
                            setIsCustomYear(false);
                            setForm((prev) => ({ ...prev, yearLevel: yr }));
                            setErrors((prev) => ({ ...prev, yearLevel: undefined }));
                          }}
                          style={[styles.pillOptionCard, isSelected && styles.pillOptionCardSelected]}
                        >
                          <Text style={[styles.pillOptionText, isSelected && styles.pillOptionTextSelected]}>
                            {yr}
                          </Text>
                        </Pressable>
                      );
                    })}

                    <Pressable
                      onPress={() => {
                        setIsCustomYear(true);
                        setForm((prev) => ({ ...prev, yearLevel: customYearInput || "" }));
                      }}
                      style={[styles.pillOptionCard, isCustomYear && styles.pillOptionCardSelected]}
                    >
                      <Text style={[styles.pillOptionText, isCustomYear && styles.pillOptionTextSelected]}>
                        Others
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>

              {/* Input for Others sticking to Continue Button on the Bottom */}
              <View style={[styles.bottomStickArea, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16) }]}>
                {isCustomYear && (
                  <View style={{ marginBottom: 12 }}>
                    <TextInput
                      value={customYearInput}
                      onChangeText={(t) => {
                        setCustomYearInput(t);
                        setForm((prev) => ({ ...prev, yearLevel: t }));
                        setErrors((prev) => ({ ...prev, yearLevel: undefined }));
                      }}
                      placeholder="Enter year level (e.g. Irregular, 5th Year)"
                      placeholderTextColor="#9CA3AF"
                      autoFocus
                      style={styles.customInputStyle}
                    />
                  </View>
                )}

                <Button
                  label="Continue to Campus Organizations"
                  variant="primary"
                  pill
                  size="lg"
                  disabled={!form.yearLevel}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={() => setAcademicSubStep("organizations")}
                  className="w-full"
                />
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════
                STEP 2: SUB-STEP 5: ORGANIZATIONS (Input sticks to button, expands up)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 2 && academicSubStep === "organizations" && (
            <View style={styles.stepContainer}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
              </View>

              {/* Center: Selected Organization Badges / Empty state */}
              <View style={styles.centeredArea}>
                {form.organizations.length > 0 ? (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}
                  >
                    <View style={styles.selectedOrgsWrap}>
                      {form.organizations.map((org) => (
                        <View key={org} style={styles.orgSelectedPill}>
                          <Text style={styles.orgSelectedText}>{org}</Text>
                          <Pressable
                            onPress={() =>
                              setForm((prev) => ({
                                ...prev,
                                organizations: prev.organizations.filter((o) => o !== org),
                              }))
                            }
                            hitSlop={8}
                            style={{ marginLeft: 6 }}
                          >
                            <X size={14} color="#6B7280" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
                    <View style={styles.orgCenterIconCircle}>
                      <GraduationCap size={32} color="#1A6B3C" />
                    </View>
                    <Text style={styles.orgCenterHintText}>
                      Belong to a student council, academic society, or club? Type below to add it, or continue if none.
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom: Input + Dynamic Suggestions extending up + Continue Button */}
              <View style={[styles.bottomStickArea, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16) }]}>
                {/* Suggestions Modal/Dropdown extending UPWARD up to max-height */}
                {isOrgInputActive && orgSearchQuery.trim().length > 0 && (
                  <View style={styles.orgSuggestionsBox}>
                    <ScrollView
                      style={{ maxHeight: 200 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {matchingOrgs.map((org) => (
                        <Pressable
                          key={org}
                          onPress={() => {
                            if (!form.organizations.includes(org)) {
                              setForm((prev) => ({
                                ...prev,
                                organizations: [...prev.organizations, org],
                              }));
                            }
                            setOrgSearchQuery("");
                          }}
                          style={styles.orgSuggestionRow}
                        >
                          <Text style={styles.orgSuggestionText}>{org}</Text>
                          <Plus size={16} color="#1A6B3C" />
                        </Pressable>
                      ))}

                      {showCustomOrgAdd && (
                        <Pressable
                          onPress={() => {
                            const trimmed = orgSearchQuery.trim();
                            if (trimmed && !form.organizations.includes(trimmed)) {
                              setForm((prev) => ({
                                ...prev,
                                organizations: [...prev.organizations, trimmed],
                              }));
                            }
                            setOrgSearchQuery("");
                          }}
                          style={styles.orgSuggestionRowAdd}
                        >
                          <Plus size={16} color="#1A6B3C" />
                          <Text style={styles.orgSuggestionAddText}>
                            Add "{orgSearchQuery.trim()}" to organizations
                          </Text>
                        </Pressable>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Input sticking to the button */}
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.orgInputContainer}>
                    <Search size={17} color="#9CA3AF" />
                    <TextInput
                      ref={orgInputRef}
                      value={orgSearchQuery}
                      onChangeText={(t) => setOrgSearchQuery(t)}
                      onFocus={() => setIsOrgInputActive(true)}
                      placeholder={
                        form.organizations.length === 0
                          ? "Type to search or add organizations..."
                          : "Add more organizations..."
                      }
                      placeholderTextColor="#9CA3AF"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        const trimmed = orgSearchQuery.trim();
                        if (!trimmed) return;
                        if (matchingOrgs.length > 0) {
                          const pick = matchingOrgs[0];
                          if (!form.organizations.includes(pick)) {
                            setForm((prev) => ({
                              ...prev,
                              organizations: [...prev.organizations, pick],
                            }));
                          }
                        } else if (!form.organizations.includes(trimmed)) {
                          setForm((prev) => ({
                            ...prev,
                            organizations: [...prev.organizations, trimmed],
                          }));
                        }
                        setOrgSearchQuery("");
                      }}
                      style={styles.orgTextInput}
                    />
                    {orgSearchQuery.length > 0 && (
                      <Pressable onPress={() => setOrgSearchQuery("")} hitSlop={8}>
                        <X size={16} color="#9CA3AF" />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Continue button */}
                <Button
                  label={form.organizations.length > 0 ? "Continue to Interests" : "Skip & Continue"}
                  variant="primary"
                  pill
                  size="lg"
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={() => setStep(3)}
                  className="w-full"
                />
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════
                STEP 3: INTERESTS (Centered Options, Input & Button Stick on Bottom)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>

                {/* Category Horizontal Filter Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
                >
                  {["All", ...Object.keys(INTERESTS_BY_CATEGORY)].map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setActiveCategory(cat)}
                      style={[
                        styles.catPill,
                        activeCategory === cat && styles.catPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          activeCategory === cat && styles.catPillTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Options in the Center */}
              <View style={styles.centeredArea}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 10 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                    {displayedInterests.map((item) => {
                      const isSelected = form.interests.includes(item);
                      return (
                        <Pressable
                          key={item}
                          onPress={() => toggleInterest(item)}
                          style={[styles.interestPill, isSelected && styles.interestPillSelected]}
                        >
                          <Text style={[styles.interestPillText, isSelected && styles.interestPillTextSelected]}>
                            {item}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <Text style={styles.interestCounterText}>
                  Selected:{" "}
                  <Text style={{ fontWeight: "700", color: form.interests.length >= 3 ? "#1A6B3C" : "#D97706" }}>
                    {form.interests.length}
                  </Text>{" "}
                  (minimum 3 required)
                </Text>
              </View>

              {/* Bottom: Custom Interest Input and Continue Button Stick Together */}
              <View style={[styles.bottomStickArea, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16) }]}>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <TextInput
                    value={customInterest}
                    onChangeText={setCustomInterest}
                    placeholder="Others (e.g. Robotics, Filmmaking)..."
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    onSubmitEditing={addCustomInterest}
                    style={[styles.customInputStyle, { flex: 1 }]}
                  />
                  <Pressable
                    onPress={addCustomInterest}
                    disabled={!customInterest.trim()}
                    style={[styles.addInterestBtn, !customInterest.trim() && { opacity: 0.5 }]}
                  >
                    <Text style={styles.addInterestBtnText}>Add</Text>
                  </Pressable>
                </View>

                <Button
                  label={
                    form.interests.length < 3
                      ? `Pick ${3 - form.interests.length} more interest${3 - form.interests.length > 1 ? "s" : ""}`
                      : "Continue to Profile & Bio"
                  }
                  variant="primary"
                  pill
                  size="lg"
                  disabled={form.interests.length < 3}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={() => setStep(4)}
                  className="w-full"
                />
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════
                STEP 4: PROFILE & COMPLETE REGISTRATION (Mirrors Web)
             ═════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{currentTitle}</Text>
                <Text style={styles.subtitle}>{currentSubtitle}</Text>
                {submitError ? (
                  <View style={{ marginTop: 12, width: "100%" }}>
                    <AlertMessage message={submitError} type="error" />
                  </View>
                ) : null}
              </View>

              {/* Scrollable Content: Avatar on Top, DiceBear Critters, Upload Label, Bio, Terms */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, width: "100%" }}
                contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 16, alignItems: "center" }}
                keyboardShouldPersistTaps="handled"
              >
                {/* 1. Top: Avatar Circle */}
                <View style={styles.profileTopSection}>
                  <View style={styles.mainAvatarContainer}>
                    {customAvatarUri ? (
                      <Image
                        source={{ uri: customAvatarUri }}
                        style={styles.mainAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <AnonymousAvatar
                        avatarKey={form.avatar || "fox"}
                        size={112}
                        borderWidth={4}
                      />
                    )}
                  </View>

                  {/* Username below Avatar */}
                  <Text style={styles.profileHandleText}>
                    {form.username ? `@${form.username}` : "@username"}
                  </Text>

                  {/* Course and Year below Username */}
                  <Text style={styles.profileCourseText}>
                    {form.course || "Degree Program"}
                    {form.yearLevel ? ` · ${form.yearLevel}` : ""}
                  </Text>
                </View>

                {/* 2. Choose anonymous avatar (DiceBear critters grid) */}
                <View style={styles.crittersSection}>
                  <Text style={styles.crittersSectionLabel}>
                    Choose anonymous avatar
                  </Text>
                  <View style={styles.crittersGrid}>
                    {ANIMAL_KEYS.map((animal) => {
                      const isSelected = !customAvatarUri && form.avatar === animal;
                      return (
                        <Pressable
                          key={animal}
                          onPress={() => {
                            setForm((prev) => ({ ...prev, avatar: animal }));
                            setCustomAvatarUri(null);
                          }}
                          style={[
                            styles.critterBtn,
                            isSelected && styles.critterBtnSelected,
                          ]}
                          accessibilityLabel={animal}
                        >
                          <AnonymousAvatar avatarKey={animal} size={46} borderWidth={1.5} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Upload photo simple label */}
                <View style={styles.uploadPhotoSection}>
                  <Pressable
                    onPress={pickCustomPhoto}
                    style={styles.uploadPhotoBtn}
                    hitSlop={8}
                  >
                    <Camera size={15} color="#1A6B3C" />
                    <Text style={styles.uploadPhotoText}>Upload photo</Text>
                  </Pressable>
                  {customAvatarUri && (
                    <Pressable
                      onPress={() => {
                        setCustomAvatarUri(null);
                        setForm((prev) => ({ ...prev, avatar: "fox" }));
                      }}
                      hitSlop={8}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={styles.removePhotoText}>Remove custom photo</Text>
                    </Pressable>
                  )}
                </View>

                {/* 4. Bio Textarea */}
                <View style={styles.bioSection}>
                  <View style={styles.bioLabelRow}>
                    <Text style={styles.bioLabel}>
                      Bio <Text style={styles.optionalText}>(optional)</Text>
                    </Text>
                    <Text style={styles.bioCounter}>{form.bio.length}/250</Text>
                  </View>
                  <TextInput
                    value={form.bio}
                    onChangeText={(v) => set("bio", v.slice(0, 250))}
                    placeholder="Share a short intro about yourself, hobbies, or campus goals..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    maxLength={250}
                    style={styles.bioTextInput}
                  />
                </View>

                {/* 5. Terms & Policy Paragraph + Single Checkbox */}
                <View style={styles.termsAgreementSection}>
                  <Text style={styles.termsParagraphText}>
                    By completing registration, you agree to our{" "}
                    <Text
                      onPress={() => setActiveModal("terms")}
                      style={styles.termsLink}
                    >
                      Terms & Conditions
                    </Text>{" "}
                    and{" "}
                    <Text
                      onPress={() => setActiveModal("privacy")}
                      style={styles.termsLink}
                    >
                      Campus Privacy Policy
                    </Text>
                    . Ally-jis is strictly exclusive to CHMSU students and requires authentic student identities and respectful peer conduct across all campus features.
                  </Text>

                  <Pressable
                    onPress={() => {
                      setAgreedToTerms((prev) => !prev);
                      setTermsError("");
                    }}
                    style={styles.termsCheckboxRow}
                  >
                    <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
                      {agreedToTerms && <Check size={12} color="#FFFFFF" />}
                    </View>
                    <Text style={styles.termsCheckboxLabel}>
                      I agree to the Terms & Conditions and Privacy Policy
                    </Text>
                  </Pressable>
                  {termsError ? <Text style={styles.errorText}>{termsError}</Text> : null}
                </View>
              </ScrollView>

              {/* Complete Registration Button */}
              <View style={[styles.bottomStickArea, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16) }]}>
                <Button
                  label={isSubmitting ? "Finalizing Profile..." : "Complete Registration"}
                  variant="primary"
                  pill
                  size="lg"
                  disabled={isSubmitting || !agreedToTerms}
                  icon={<Check size={16} color="#FFFFFF" />}
                  onPress={handleNextAvatar}
                  className="w-full"
                />
              </View>
            </View>
          )}

        </View>
      </KeyboardHugView>

      {/* ── Legal / Terms Modal ── */}
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

// ── Legal / Terms Modal ──────────────────────────────────────────────────────

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
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 24,
          padding: 24,
          width: "100%",
          maxHeight: "80%",
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

        <Button label="I Agree & Accept" variant="primary" pill size="lg" onPress={onAccept} />
      </Pressable>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  headerText: {
    alignItems: "center",
    marginBottom: 12,
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
  centeredArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  centeredScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingVertical: 10,
  },
  optionsWrap: {
    width: "100%",
    maxWidth: 440,
    gap: 12,
  },
  bottomStickArea: {
    width: "100%",
    marginTop: "auto",
    paddingTop: 12,
  },
  // Email Badges
  emailBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.5,
  },
  badgeChmsu: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1A6B3C15",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1A6B3C30",
  },
  badgeChmsuText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1A6B3C",
  },
  badgeExternal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  badgeExternalText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B45309",
  },
  typoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -12,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  typoBannerText: {
    fontSize: 12,
    color: "#DC2626",
  },
  // Step 2 Username Preview
  usernamePreviewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A6B3C12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  usernameHandlePreview: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  // Pill Option Cards (Dept, Course, Year)
  pillOptionCard: {
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pillOptionCardSelected: {
    borderColor: "#1A6B3C",
    backgroundColor: "#1A6B3C12",
  },
  pillOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  pillOptionTextSelected: {
    color: "#1A6B3C",
    fontWeight: "700",
  },
  emptyCourseBox: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCourseText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  customInputStyle: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 14,
    color: "#111827",
  },
  // Step 2 Organizations
  orgCenterIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1A6B3C10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  orgCenterHintText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
  },
  selectedOrgsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  orgSelectedPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  orgSelectedText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1F2937",
  },
  orgInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2DED7",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  orgTextInput: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    padding: 0,
  },
  orgSuggestionsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 8,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  orgSuggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  orgSuggestionText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  orgSuggestionRowAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  orgSuggestionAddText: {
    fontSize: 13,
    color: "#1A6B3C",
    fontWeight: "700",
  },
  // Step 3 Interests
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  catPillSelected: {
    borderColor: "#1A6B3C",
    backgroundColor: "#1A6B3C",
  },
  catPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  catPillTextSelected: {
    color: "#FFFFFF",
  },
  interestPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2DED7",
    backgroundColor: "#FFFFFF",
  },
  interestPillSelected: {
    borderColor: "#1A6B3C",
    backgroundColor: "#1A6B3C",
  },
  interestPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  interestPillTextSelected: {
    color: "#FFFFFF",
  },
  interestCounterText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  addInterestBtn: {
    backgroundColor: "#1A6B3C",
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  addInterestBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  // Step 4 Profile Styles
  profileTopSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  mainAvatarContainer: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mainAvatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: "#1A6B3C",
  },
  profileHandleText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  profileCourseText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 2,
  },
  crittersSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  crittersSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 12,
  },
  crittersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    maxWidth: 320,
  },
  critterBtn: {
    padding: 2,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: "transparent",
  },
  critterBtnSelected: {
    borderColor: "#1A6B3C",
    transform: [{ scale: 1.08 }],
  },
  uploadPhotoSection: {
    alignItems: "center",
    marginBottom: 18,
  },
  uploadPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  uploadPhotoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A6B3C",
  },
  removePhotoText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "500",
  },
  bioSection: {
    width: "100%",
    marginBottom: 16,
  },
  bioLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  bioLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 0.5,
  },
  optionalText: {
    fontWeight: "400",
    color: "#9CA3AF",
  },
  bioCounter: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  bioTextInput: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    minHeight: 70,
    textAlignVertical: "top",
  },
  termsAgreementSection: {
    width: "100%",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 10,
  },
  termsParagraphText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    textAlign: "center",
  },
  termsCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    paddingVertical: 4,
  },
  termsCheckboxLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: {
    borderColor: "#1A6B3C",
    backgroundColor: "#1A6B3C",
  },
  termsLink: {
    color: "#1A6B3C",
    fontWeight: "700",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 8,
  },
  // Done Screen
  doneContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  doneIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#1A6B3C15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  doneSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});

const labelStyle = {
  fontSize: 13,
  fontWeight: "700" as const,
  color: "#374151",
};