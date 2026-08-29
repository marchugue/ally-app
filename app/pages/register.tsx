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
} from "react-native";
import { router } from "expo-router";
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
import { DiagonalStripes } from "@/components/DiagonalStripes";
import { SlideIn } from "@/components/SlideIn";
import { Button } from "@/components/Button";
import { buildRegisterPayload } from "@/lib/validator/buildRegisterPayload";
import Input from "@/components/buttons/button";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import LoadingOverlay from "@/components/LoadingOverlay";
import AnimatedBottomSheet from "@/components/AnimatedBottomSheet";


// ── Constants ────────────────────────────────────────────────────────────────

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

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

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

const TERMS_TEXT = `Welcome to Ally-jis! These are placeholder Terms & Conditions.

By using this platform, you agree to use Ally-jis respectfully and only for its intended purpose of connecting with fellow CHMSU Alijis Campus students.

This is sample text. Replace this with your actual Terms & Conditions before launch.`;

const PRIVACY_TEXT = `This is a placeholder Privacy Policy for Ally-jis.

We collect basic profile information (username, email, course, interests) to help you connect with other students on campus.

This is sample text. Replace this with your actual Privacy Policy before launch.`;

const STEPS = [
  { num: 1, label: "Basic Info",    icon: User,          hint: "Your identity on the platform" },
  { num: 2, label: "Academic",      icon: GraduationCap, hint: "Your course & year at CHMSU" },
  { num: 3, label: "Interests",     icon: Sparkles,       hint: "Powers your matches!" },
  { num: 4, label: "Avatar & Bio",  icon: FileText,       hint: "Pick your emoji & intro" },
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

// ── Main Component ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth()
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(null);
  const [lastModalContent, setLastModalContent] = useState<"terms" | "privacy">("terms");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [Touched, setTouched] = useState(false);
  // custom interests
  const [customInterest, setCustomInterest] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // dept picker modal
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);

  // Keeps the modal's title/body showing the right content while it
  // fades out, instead of flashing to the other one as activeModal → null.
  useEffect(() => {
    if (activeModal) setLastModalContent(activeModal);
  }, [activeModal]);

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

  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "terms", string>>>({});

  const set = (key: keyof FormData, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const allInterestLabels = Object.values(INTERESTS_BY_CATEGORY).flat();
  const customInterests = form.interests.filter(i => !allInterestLabels.includes(i));
  const availableCourses = form.department ? (DEPARTMENTS[form.department] ?? []) : [];
  const payload = buildRegisterPayload(form);

  // ── Validation ─────────────────────────────────────────────────────────────
  const usernameError =
    Touched && form.username.trim().length > 0
      ? validateUsername(form.username)
      : null;

  const emailError =
    Touched && form.email.trim().length > 0
      ? validateEmail(form.email)
      : null;

  const passwordError =
    Touched && form.password.length > 0
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
      const usernameError = Touched && form.username.trim().length > 0 ? validateUsername(form.username) : null;
      if (usernameError) errs.username = usernameError;

      const emailError = validateEmail(form.email);
      if (emailError) errs.email = emailError;

      const passwordError = validatePass(form.password);
      if (passwordError) errs.password = passwordError;
    }

    if (step === 2) {
      const departmentError = validateDepartment(form.department);
      if (departmentError) errs.department = departmentError;

      const courseError = validateCourse(form.course);
      if (courseError) errs.course = courseError;

      const yearLevelError = validateYearLevel(form.yearLevel);
      if (yearLevelError) errs.yearLevel = yearLevelError;
    }

    if (step === 3) {
      const interestsError = validateInterests(form.interests);
      if (interestsError) errs.interests = interestsError;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (!validate()) return;
    setSubmitError("");

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

  const handleBack = () => {
    if (step > 1) {
      setStep(s => s - 1);
      setSubmitError("");
    } else {
      router.back();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await Promise.all([
        signUp(payload),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
      setIsDone(true)
    } catch (err: any) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live-validates interests on every change so the error (and the
  // "select N more" hint) stays accurate without waiting for "Continue".
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
          backgroundColor: "#FDFCFB",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#1A6B3C",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            shadowColor: "#1A6B3C",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Check size={36} color="#fff" />
        </View>

        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: "#1A6B3C",
            letterSpacing: -0.5,
            marginBottom: 6,
          }}
        >
          Profile Created!
        </Text>

        <Button
          label="Go to Login"
          onPress={() => router.replace("/pages/login" as any)}
          className="w-full mt-8"
        />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const StepIcon = STEPS[step - 1].icon;

  return (
    <View style={{ flex: 1, backgroundColor: "#1A6B3C" }}>
      <StatusBar barStyle="light-content" />

      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: 90, overflow: "hidden" }}>
        <DiagonalStripes />

        <Pressable
          onPress={handleBack}
          disabled={isSubmitting}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingVertical: 8,
            opacity: isSubmitting ? 0.4 : 1,
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>Back</Text>
        </Pressable>

        <SlideIn delay={0} style={{ alignItems: "center" }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 }}>
            Ally<Text style={{ color: "#E8A838" }}>-jis</Text>
          </Text>
        </SlideIn>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SlideIn delay={120} distance={30} style={{ flex: 1, marginTop: -60 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#FDFCFB",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
            }}
          >
            {/* ── Fixed header: step indicators, progress, title/hint ── */}
            <View style={{ paddingHorizontal: 28, paddingTop: 28 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                {STEPS.map(({ num }, i) => (
                  <View key={num} style={{ flexDirection: "row", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
                    <View
                      style={{
                        width: 30, height: 30, borderRadius: 15,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: step >= num ? "#1A6B3C" : "#F0EDE8",
                      }}
                    >
                      {step > num
                        ? <Check size={13} color="#fff" />
                        : <Text style={{ fontSize: 12, fontWeight: "700", color: step === num ? "#fff" : "#9CA3AF" }}>{num}</Text>
                      }
                    </View>
                    {i < STEPS.length - 1 && (
                      <View style={{ flex: 1, height: 2, marginHorizontal: 4, backgroundColor: step > num ? "#1A6B3C" : "#E2DED7", borderRadius: 1 }} />
                    )}
                  </View>
                ))}
              </View>

              {submitError ? (
                <View style={{ marginBottom: 20 }}>
                  <AlertMessage message={submitError} type="error" />
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#1A6B3C12", alignItems: "center", justifyContent: "center" }}>
                  <StepIcon size={16} color="#1A6B3C" />
                </View>
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#1A6B3C", letterSpacing: -0.5 }}>
                  {STEPS[step - 1].label}
                </Text>
              </View>
              <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 24 }}>
                {STEPS[step - 1].hint}
              </Text>
            </View>

            {/* ── Scrollable: step content + footer ── */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 28,
                paddingBottom: insets.bottom + 32,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {/* ── STEP 1: Basic Info ── */}
              {step === 1 && (
                <View>
                  <Input
                    value={form.username}
                    onChangeText={(text) => setForm((prev) => ({...prev,username: text,}))}
                    onBlur={() => setTouched(true)}
                    error={usernameError}
                    placeholder="Username"
                  />

                  <EmailInput
                    value={form.email}
                    onChangeText={(text) => setForm((prev) => ({...prev,email: text,}))}
                    onBlur={() => setTouched(true)}
                    error={emailError}
                    placeholder="Your@chmsu.edu.ph"
                  />

                  <PasswordInput
                    value={form.password}
                    onChangeText={(text) => setForm((prev) => ({...prev,password: text,}))}
                    onBlur={() => setTouched(true)}
                    error={passwordError} 
                  />
                </View>
              )}

              {/* ── STEP 2: Academic ── */}
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

                  <Text style={[labelStyle, { marginTop: 22 }]}>
                    Student Organizations{" "}
                    <Text style={{ color: "#9CA3AF", fontWeight: "400" }}>(optional)</Text>
                  </Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
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

              {/* ── Footer buttons ── */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 32 }}>
                <Button
                  label="Back"
                  variant="secondary"
                  size="lg"
                  onPress={handleBack}
                  disabled={isSubmitting}
                />
                <Button
                  label={isSubmitting ? "Processing…" : step === 4 ? "Complete Profile" : "Continue"}
                  variant="primary"
                  pill
                  size="lg"
                  disabled={isSubmitting || (step === 4 && !agreedToTerms)}
                  icon={step === 4 ? <Check size={16} color="#FFFFFF" /> : <ArrowRight size={16} color="#FFFFFF" />}
                  onPress={handleNext}
                  className="flex-1"
                />
              </View>
              <View style={{ marginTop: "auto", marginBottom: -24 }}>
                <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
                  <Text style={{ fontSize: 13, color: "#6B7280" }}>Already have an account?</Text>
                  <Pressable onPress={() => router.replace("/pages/login")}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1A6B3C" }}>Sign in</Text>
                  </Pressable>
                </View>

                <Text style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 10, lineHeight: 16 }}>
                  For CHMSU Alijis Campus students only
                </Text>
              </View>
            </ScrollView>
          </View>
        </SlideIn>
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
      <AnimatedBottomSheet visible={!!activeModal} onClose={() => setActiveModal(null)} maxHeightPct="80%">
        <View style={{ backgroundColor: "#1A6B3C", paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
            {lastModalContent === "terms" ? "Terms & Conditions" : "Privacy Policy"}
          </Text>
          <Pressable onPress={() => setActiveModal(null)} hitSlop={8}>
            <X size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
        <ScrollView style={{ paddingHorizontal: 24, paddingTop: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#374151", lineHeight: 22 }}>
            {lastModalContent === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
          </Text>
        </ScrollView>
        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: "#F0EDE8" }}>
          <Button
            label="I Agree"
            variant="primary"
            pill
            size="lg"
            className="w-full"
            onPress={() => {
              if (activeModal === "terms") { setAgreedToTerms(true); setTermsError(""); }
              setActiveModal(null);
            }}
          />
        </View>
      </AnimatedBottomSheet>

      <LoadingOverlay visible={isSubmitting} />
    </View>
  );
}

// ── Picker Modal ─────────────────────────────────────────────────────────────

function PickerModal({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose} maxHeightPct="70%">
      <View style={{ paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: "#F0EDE8", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={18} color="#6B7280" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
        {options.map(opt => (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={{
              paddingHorizontal: 24, paddingVertical: 14,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 14, color: selected === opt ? "#1A6B3C" : "#374151", fontWeight: selected === opt ? "700" : "400", flex: 1 }}>
              {opt}
            </Text>
            {selected === opt && <Check size={16} color="#1A6B3C" />}
          </Pressable>
        ))}
      </ScrollView>
    </AnimatedBottomSheet>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 12,
  fontWeight: "600" as const,
  color: "#374151",
};

const rowInputStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#FFFFFF",
  borderWidth: 1.5,
  borderColor: "#E2DED7",
  borderRadius: 20,
  paddingHorizontal: 18,
  paddingVertical: 10,
};

const errorRowStyle = {
  borderColor: "#FECACA",
  backgroundColor: "#FEF2F2",
};

const multilineInputStyle = {
  borderWidth: 1.5,
  borderColor: "#E2DED7",
  borderRadius: 20,
  paddingHorizontal: 18,
  paddingVertical: 14,
  paddingBottom: 28,
  fontSize: 14,
  color: "#111827",
  backgroundColor: "#FFFFFF",
  minHeight: 100,
  textAlignVertical: "top" as const,
};