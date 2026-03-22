/**
 * Profile screen — full-screen modal combining optional account management
 * with the spirit animal feature.
 *
 * Accessible from the top-right button on the History screen (same location
 * as the old spirit animal button). Login/signup is entirely optional — users
 * can dismiss this screen and continue using the app without an account.
 */

import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";

import { useAuth } from "@/context/AuthContext";
import { useSpiritAnimal } from "@/context/SpiritAnimalContext";

type FormMode = "login" | "signup";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading: authLoading, login, signup, logout, deleteAccount } = useAuth();
  const { spiritAnimal, clearSpiritAnimal } = useSpiritAnimal();

  const [mode, setMode] = useState<FormMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please fill in both fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setSubmitting(true);

    const result =
      mode === "signup"
        ? await signup(trimmedEmail, password)
        : await login(trimmedEmail, password);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
    } else {
      setEmail("");
      setPassword("");
    }
  }

  function handleLogout() {
    Alert.alert("Log out?", "Your local data will remain on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently removes your account. Local data on this device is kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteAccount();
          },
        },
      ],
    );
  }

  function handleSpiritAnimalPress() {
    router.push("/spirit-animal-quiz");
  }

  function handleClearSpiritAnimal() {
    Alert.alert("Reset spirit animal?", "You can retake the quiz anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: clearSpiritAnimal },
    ]);
  }

  if (authLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator color="rgba(255,255,255,0.6)" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={16}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Avatar ──────────────────────────────────────────── */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {spiritAnimal ? (
                <SvgXml xml={spiritAnimal.svg} width={48} height={48} />
              ) : (
                <Ionicons
                  name={user ? "person" : "person-outline"}
                  size={36}
                  color="rgba(255,255,255,0.35)"
                />
              )}
            </View>
            <Text style={styles.screenTitle}>
              {user ? (user.displayName || user.email) : "Your Profile"}
            </Text>
            {user && (
              <Text style={styles.emailLabel}>{user.email}</Text>
            )}
          </View>

          {/* ── Spirit Animal Section ───────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spirit Animal</Text>

            {spiritAnimal ? (
              <View style={styles.spiritCard}>
                <View style={styles.spiritCardHeader}>
                  <View style={styles.spiritCardAvatar}>
                    <SvgXml xml={spiritAnimal.svg} width={32} height={32} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spiritCardName}>{spiritAnimal.animal}</Text>
                    <Text style={styles.spiritCardLabel}>your guide</Text>
                  </View>
                </View>
                <Text style={styles.spiritCardDesc}>{spiritAnimal.description}</Text>
                <View style={styles.spiritCardActions}>
                  <Pressable
                    style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
                    onPress={handleSpiritAnimalPress}
                  >
                    <Text style={styles.outlineBtnText}>Retake quiz</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
                    onPress={handleClearSpiritAnimal}
                  >
                    <Text style={styles.ghostBtnText}>Reset</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.discoverBtn, pressed && styles.discoverBtnPressed]}
                onPress={handleSpiritAnimalPress}
              >
                <Ionicons name="sparkles-outline" size={20} color="rgba(255,255,255,0.7)" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.discoverBtnTitle}>Discover your guide</Text>
                  <Text style={styles.discoverBtnSub}>Take a short quiz to find your spirit animal</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
              </Pressable>
            )}
          </View>

          {/* ── Account Section ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            {user ? (
              /* ── Logged in ─────────────────────────────────── */
              <View style={styles.accountCard}>
                <View style={styles.accountRow}>
                  <Ionicons name="mail-outline" size={16} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.accountRowText}>{user.email}</Text>
                </View>

                <View style={styles.accountActions}>
                  <Pressable
                    style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}
                    onPress={handleLogout}
                  >
                    <Text style={styles.outlineBtnText}>Log out</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
                    onPress={handleDeleteAccount}
                  >
                    <Text style={[styles.ghostBtnText, { color: "rgba(239,68,68,0.7)" }]}>
                      Delete account
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── Not logged in ─────────────────────────────── */
              <View style={styles.formCard}>
                <Text style={styles.formSubtitle}>
                  {mode === "signup"
                    ? "Create an account to save your progress across devices"
                    : "Welcome back"}
                </Text>

                {error !== "" && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(""); }}
                  />
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 48 }]}
                      placeholder="Password"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(""); }}
                    />
                    <Pressable
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color="rgba(255,255,255,0.3)"
                      />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                    submitting && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {mode === "signup" ? "Sign up" : "Log in"}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setMode(mode === "signup" ? "login" : "signup");
                    setError("");
                  }}
                >
                  <Text style={styles.toggleText}>
                    {mode === "signup"
                      ? "Already have an account? Log in"
                      : "Need an account? Sign up"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.4)",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 32,
  },

  // ── Avatar ──────────────────────────────────────────────────────────
  avatarContainer: {
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  emailLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
  },

  // ── Sections ────────────────────────────────────────────────────────
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // ── Spirit animal card ──────────────────────────────────────────────
  spiritCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  spiritCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  spiritCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  spiritCardName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textTransform: "capitalize",
  },
  spiritCardLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  spiritCardDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 20,
  },
  spiritCardActions: {
    flexDirection: "row",
    gap: 10,
  },

  // ── Discover button ─────────────────────────────────────────────────
  discoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  discoverBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  discoverBtnTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  discoverBtnSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },

  // ── Account card (logged in) ────────────────────────────────────────
  accountCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accountRowText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  accountActions: {
    gap: 8,
  },

  // ── Form card (not logged in) ───────────────────────────────────────
  formCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  formSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(239,68,68,0.9)",
  },
  inputGroup: {
    gap: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#fff",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    padding: 4,
  },

  // ── Buttons ─────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
    letterSpacing: -0.3,
  },
  outlineBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  outlineBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  outlineBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  ghostBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
  },
  toggleText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
});
