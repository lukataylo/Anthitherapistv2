/**
 * SpiritAnimalContext — persists the user's spirit animal guide.
 *
 * Stores { animal, description, svg } in AsyncStorage under `spirit_animal_v1`.
 * Exposes spiritAnimal, setSpiritAnimal, and clearSpiritAnimal.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "spirit_animal_v1";

export interface SpiritAnimal {
  animal: string;
  description: string;
  svg: string;
}

interface SpiritAnimalContextValue {
  spiritAnimal: SpiritAnimal | null;
  setSpiritAnimal: (sa: SpiritAnimal) => void;
  clearSpiritAnimal: () => void;
}

const SpiritAnimalContext = createContext<SpiritAnimalContextValue | null>(null);

export function SpiritAnimalProvider({ children }: { children: ReactNode }) {
  const [spiritAnimal, setSpiritAnimalState] = useState<SpiritAnimal | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as SpiritAnimal;
          if (parsed.animal && parsed.description && parsed.svg) {
            setSpiritAnimalState(parsed);
          }
        }
      })
      .catch(() => {});
  }, []);

  const setSpiritAnimal = useCallback((sa: SpiritAnimal) => {
    setSpiritAnimalState(sa);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sa)).catch(() => {});
  }, []);

  const clearSpiritAnimal = useCallback(() => {
    setSpiritAnimalState(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <SpiritAnimalContext.Provider value={{ spiritAnimal, setSpiritAnimal, clearSpiritAnimal }}>
      {children}
    </SpiritAnimalContext.Provider>
  );
}

export function useSpiritAnimal(): SpiritAnimalContextValue {
  const ctx = useContext(SpiritAnimalContext);
  if (!ctx) throw new Error("useSpiritAnimal must be used inside SpiritAnimalProvider");
  return ctx;
}
