import { ref, computed, onMounted } from "vue";
import { getStoredValue, setStoredValue } from "./useStorage";

interface TutorialHintsState {
  clickDot: boolean;
  spinWheel: boolean;
}

const STORAGE_KEY = "tutorial-hints";

const defaultState: TutorialHintsState = {
  clickDot: false,
  spinWheel: false,
};

export function useTutorialHints() {
  const hintsSeen = ref<TutorialHintsState>({ ...defaultState });
  const isLoaded = ref(false);

  onMounted(async () => {
    const stored = await getStoredValue(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<TutorialHintsState>;
        hintsSeen.value = { ...defaultState, ...parsed };
      } catch {
        // Invalid JSON, use defaults
      }
    }
    isLoaded.value = true;
  });

  async function markHintSeen(hint: keyof TutorialHintsState) {
    hintsSeen.value[hint] = true;
    await setStoredValue(STORAGE_KEY, JSON.stringify(hintsSeen.value));
  }

  async function resetHints() {
    hintsSeen.value = { ...defaultState };
    await setStoredValue(STORAGE_KEY, JSON.stringify(hintsSeen.value));
  }

  const hasSeenClickDotHint = computed(() => hintsSeen.value.clickDot);
  const hasSeenSpinWheelHint = computed(() => hintsSeen.value.spinWheel);

  return {
    isLoaded,
    hasSeenClickDotHint,
    hasSeenSpinWheelHint,
    markHintSeen,
    resetHints,
  };
}
