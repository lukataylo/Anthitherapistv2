import AsyncStorage from "@react-native-async-storage/async-storage";
import { evaluateArcState } from "@/src/modules/arcController";
import { assembleFeedback } from "@/src/modules/feedbackAssembler";
import { matchPatterns } from "@/src/modules/patternMatcher";
import type { Analysis, Session, Turn } from "@/src/types";

const ACTIVE_SESSION_KEY = "temet_active_session";
const ACTIVE_TURNS_KEY = "temet_active_turns";
const ACTIVE_ANALYSES_KEY = "temet_active_analyses";
const HISTORY_KEY = "temet_session_history";

const LEGACY_HISTORY_KEY = "reframe_history_v1";

type SessionState = {
  session: Session | null;
  turns: Turn[];
  analyses: Analysis[];
};

type LegacyHistoryEntry = {
  id: string;
  thought: string;
  words?: unknown[];
  savedAt: number;
};

const initialState: SessionState = {
  session: null,
  turns: [],
  analyses: [],
};

function getInitialState(): SessionState {
  return { session: null, turns: [], analyses: [] };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

class SessionStore {
  private state: SessionState = getInitialState();

  getState(): SessionState {
    return this.state;
  }

  async loadFromStorage(): Promise<SessionState> {
    await this.migrateLegacyHistoryIfNeeded();
    const [rawSession, rawTurns, rawAnalyses] = await AsyncStorage.multiGet([
      ACTIVE_SESSION_KEY,
      ACTIVE_TURNS_KEY,
      ACTIVE_ANALYSES_KEY,
    ]);

    const parsedSession = safeParse<Session | null>(rawSession[1], null);
    const parsedTurns = safeParse<Turn[]>(rawTurns[1], []);
    const parsedAnalyses = safeParse<Analysis[]>(rawAnalyses[1], []);

    this.state = {
      session: parsedSession,
      turns: Array.isArray(parsedTurns) ? parsedTurns : [],
      analyses: Array.isArray(parsedAnalyses) ? parsedAnalyses : [],
    };
    return this.state;
  }

  async startSession(moodOnOpen: Session["moodOnOpen"]): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      completedAt: null,
      moodOnOpen,
      turnCount: 0,
      status: "active",
      feedbackPayload: null,
      sessionPhase: "descent",
      checkInState: "none",
    };
    this.state = { session, turns: [], analyses: [] };
    await this.persistActiveState();
    return session;
  }

  async addTurn(rawText: string, inputMode: Turn["inputMode"]): Promise<Turn> {
    if (!this.state.session) throw new Error("No active session");
    const turn: Turn = {
      id: crypto.randomUUID(),
      sessionId: this.state.session.id,
      index: this.state.turns.length,
      timestamp: Date.now(),
      inputMode,
      rawText,
      flags: matchPatterns(rawText),
      analysisId: null,
    };
    this.state.turns = [...this.state.turns, turn];
    this.state.session = {
      ...this.state.session,
      turnCount: this.state.turns.length,
    };
    await this.persistActiveState();
    return turn;
  }

  async storeAnalysis(analysis: Analysis): Promise<void> {
    if (!this.state.session || analysis.sessionId !== this.state.session.id) return;

    this.state.analyses = [...this.state.analyses, analysis];
    this.state.turns = this.state.turns.map((turn) =>
      turn.id === analysis.turnId ? { ...turn, analysisId: analysis.id } : turn
    );
    const arcState = evaluateArcState(this.state.session, this.state.analyses);
    this.state.session = { ...this.state.session, ...arcState };
    await this.persistActiveState();
  }

  async wrapSession(): Promise<Session | null> {
    if (!this.state.session) return null;

    const completed: Session = {
      ...this.state.session,
      completedAt: Date.now(),
      status: "complete",
      feedbackPayload: assembleFeedback(
        this.state.session.id,
        this.state.turns,
        this.state.analyses
      ),
    };
    const history = await this.getHistory();
    const nextHistory = [completed, ...history];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    await this.clearSession();
    return completed;
  }

  async clearSession(): Promise<void> {
    this.state = getInitialState();
    await AsyncStorage.multiRemove([
      ACTIVE_SESSION_KEY,
      ACTIVE_TURNS_KEY,
      ACTIVE_ANALYSES_KEY,
    ]);
  }

  async getHistorySessions(): Promise<Session[]> {
    return this.getHistory();
  }

  async upsertCompletedSession(session: Session): Promise<void> {
    const history = await this.getHistory();
    const nextHistory = [
      session,
      ...history.filter((item) => item.id !== session.id),
    ];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  }

  async removeHistorySession(sessionId: string): Promise<void> {
    const history = await this.getHistory();
    const nextHistory = history.filter((session) => session.id !== sessionId);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  }

  private async persistActiveState(): Promise<void> {
    await AsyncStorage.multiSet([
      [ACTIVE_SESSION_KEY, JSON.stringify(this.state.session)],
      [ACTIVE_TURNS_KEY, JSON.stringify(this.state.turns)],
      [ACTIVE_ANALYSES_KEY, JSON.stringify(this.state.analyses)],
    ]);
  }

  private async getHistory(): Promise<Session[]> {
    const parsed = safeParse<unknown>(await AsyncStorage.getItem(HISTORY_KEY), null);
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  }

  private async migrateLegacyHistoryIfNeeded(): Promise<void> {
    const [legacyRaw, currentRaw] = await AsyncStorage.multiGet([
      LEGACY_HISTORY_KEY,
      HISTORY_KEY,
    ]);
    if (!legacyRaw[1] || currentRaw[1]) return;

    const parsed = safeParse<unknown>(legacyRaw[1], null);
    if (!Array.isArray(parsed)) return;

    const migrated = (parsed as LegacyHistoryEntry[]).map<Session>((entry) => ({
      id: entry.id,
      createdAt: entry.savedAt,
      completedAt: entry.savedAt,
      moodOnOpen: "low",
      turnCount:
        Array.isArray(entry.words) && entry.words.length > 0 ? entry.words.length : 1,
      status: "complete",
      feedbackPayload: null,
      sessionPhase: "descent",
      checkInState: "none",
    }));
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
  }
}

export const sessionStore = new SessionStore();
