import { beforeEach, describe, expect, it, vi } from "vitest";

const storeData = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => {
  return {
    default: {
      async getItem(key: string) {
        return storeData.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        storeData.set(key, value);
      },
      async multiGet(keys: string[]) {
        return keys.map((key) => [key, storeData.get(key) ?? null]);
      },
      async multiSet(entries: [string, string][]) {
        for (const [key, value] of entries) storeData.set(key, value);
      },
      async multiRemove(keys: string[]) {
        for (const key of keys) storeData.delete(key);
      },
    },
  };
});

describe("sessionStore", () => {
  beforeEach(async () => {
    vi.resetModules();
    storeData.clear();
  });

  it("runs start -> addTurn -> storeAnalysis -> wrap lifecycle", async () => {
    const { sessionStore } = await import("@/src/modules/sessionStore");

    const session = await sessionStore.startSession("low");
    expect(session.status).toBe("active");

    const turn = await sessionStore.addTurn("I always fail", "text");
    expect(turn.flags.length).toBeGreaterThan(0);

    await sessionStore.storeAnalysis({
      id: "a1",
      turnId: turn.id,
      sessionId: session.id,
      createdAt: Date.now(),
      dominantEmotion: "shame",
      underlyingNeed: "safety",
      beliefDetected: "I am not enough",
      distortionType: "overgeneralisation",
      noteworthy: true,
      reflectionQuestion: "What did you need there?",
      emotionalLoad: 2,
      rawAnalysis: "{}",
    });

    const wrapped = await sessionStore.wrapSession();
    expect(wrapped).not.toBeNull();
    expect(wrapped?.status).toBe("complete");
    expect(wrapped?.feedbackPayload).not.toBeNull();
    expect(wrapped?.archivedTurns?.length).toBe(1);

    const active = sessionStore.getState();
    expect(active.session).toBeNull();
    expect(active.turns).toHaveLength(0);
    expect(active.analyses).toHaveLength(0);

    const history = await sessionStore.getHistorySessions();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(session.id);
  });
});
