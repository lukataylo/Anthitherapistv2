/**
 * AuthContext — optional self-hosted authentication.
 *
 * Stores a JWT token and basic user info in AsyncStorage. The app works fully
 * without login — this context simply exposes the current auth state so
 * screens can optionally show account features.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token_v1";
const USER_KEY = "auth_user_v1";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

export interface AuthUser {
  id: number;
  email: string;
  displayName: string | null;
}

type AuthResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate persisted session on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ])
      .then(([storedToken, storedUser]) => {
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, t],
      [USER_KEY, JSON.stringify(u)],
    ]).catch(() => {});
  }, []);

  const clear = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || "Login failed" };
        await persist(data.token, data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error" };
      }
    },
    [persist],
  );

  const signup = useCallback(
    async (email: string, password: string, displayName?: string): Promise<AuthResult> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || "Signup failed" };
        await persist(data.token, data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error" };
      }
    },
    [persist],
  );

  const logout = useCallback(() => {
    clear();
  }, [clear]);

  const deleteAccount = useCallback(async () => {
    if (!token) return;
    await fetch(`${API_BASE}/api/auth/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    await clear();
  }, [token, clear]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, signup, logout, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
