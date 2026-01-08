<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";
import PlayerTurnBadge from "./PlayerTurnBadge.vue";

const props = defineProps<{
  currentTurn: PlayerColor;
  turnLabel: string;
  blueDisplayName: string;
  orangeDisplayName: string;
  myColor?: PlayerColor | null;
  canNudge?: boolean;
  isNudging?: boolean;
}>();

const emit = defineEmits<{
  nudge: [];
}>();

function shouldShowNudge(badgeColor: PlayerColor): boolean {
  if (!props.canNudge || !props.myColor) return false;
  // Show nudge on opponent's badge when it's their turn
  return badgeColor !== props.myColor && props.currentTurn === badgeColor;
}
</script>

<template>
  <div class="flex items-center gap-6">
    <PlayerTurnBadge
      color="blue"
      :display-name="blueDisplayName"
      :is-active="currentTurn === 'blue'"
      :turn-label="turnLabel"
      :show-nudge="shouldShowNudge('blue')"
      :is-nudging="isNudging"
      @nudge="emit('nudge')"
    />
    <PlayerTurnBadge
      color="orange"
      :display-name="orangeDisplayName"
      :is-active="currentTurn === 'orange'"
      :turn-label="turnLabel"
      :show-nudge="shouldShowNudge('orange')"
      :is-nudging="isNudging"
      @nudge="emit('nudge')"
    />
  </div>
</template>
