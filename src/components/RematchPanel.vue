<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useConvexMutation } from "convex-vue";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { PlayerColor } from "../../lib/validation";
import { setStoredValue } from "@/composables/useStorage";

const props = defineProps<{
  game: Doc<"games">;
  code: string;
  playerId: string;
  myColor: PlayerColor;
  playerName: string;
  canNudgeRematch: boolean;
  isNudgingRematch: boolean;
}>();

const emit = defineEmits<{
  nudge: [];
}>();

const router = useRouter();
const requestRematchMutation = useConvexMutation(api.games.requestRematch);

const isRequesting = ref(false);

const rematchRequests = computed(() => props.game.rematchRequests);
const nextGameCode = computed(() => props.game.nextGameCode);

const opponentColor = computed<PlayerColor>(() =>
  props.myColor === "blue" ? "orange" : "blue"
);

const iWantedRematch = computed(
  () => rematchRequests.value?.[props.myColor] === true
);

const opponentWantsRematch = computed(
  () => rematchRequests.value?.[opponentColor.value] === true
);

type RematchState = "initial" | "waiting" | "invited" | "ready";
const rematchState = computed<RematchState>(() => {
  if (nextGameCode.value) return "ready";
  if (iWantedRematch.value) return "waiting";
  if (opponentWantsRematch.value) return "invited";
  return "initial";
});

async function navigateToNewGame() {
  if (!nextGameCode.value) return;
  // Set role for new game (swapped color)
  const newColor = opponentColor.value;
  await setStoredValue(`role-${nextGameCode.value}`, newColor);
  await setStoredValue(`name-${nextGameCode.value}`, props.playerName);
  router.push(`/game/${nextGameCode.value}`);
}

async function requestRematch() {
  isRequesting.value = true;
  try {
    await requestRematchMutation.mutate({
      code: props.code,
      playerId: props.playerId,
    });
  } finally {
    isRequesting.value = false;
  }
}
</script>

<template>
  <!-- Initial: Rematch button -->
  <UButton
    v-if="rematchState === 'initial'"
    size="xl"
    variant="outline"
    :loading="isRequesting"
    @click="requestRematch"
  >
    Rematch
  </UButton>

  <!-- Waiting: I requested -->
  <div
    v-else-if="rematchState === 'waiting'"
    class="text-center flex items-center justify-center gap-2"
  >
    <UButton
      size="xl"
      variant="outline"
      disabled
    >
      Waiting for opponent...
    </UButton>
    <UButton
      v-if="canNudgeRematch"
      size="xl"
      variant="ghost"
      icon="i-lucide-hand"
      :loading="isNudgingRematch"
      @click="emit('nudge')"
    />
  </div>

  <!-- Invited: Opponent requested -->
  <div
    v-else-if="rematchState === 'invited'"
    class="text-center"
  >
    <UButton
      size="xl"
      :loading="isRequesting"
      @click="requestRematch"
    >
      Accept Rematch
    </UButton>
  </div>

  <!-- Ready: New game created -->
  <UButton
    v-else-if="rematchState === 'ready'"
    size="xl"
    @click="navigateToNewGame"
  >
    Go to Rematch
  </UButton>
</template>
