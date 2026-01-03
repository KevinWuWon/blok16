<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";
import PlayerTurnBadge from "./PlayerTurnBadge.vue";

defineProps<{
  currentTurn: PlayerColor;
  turnLabel: string;
  blueDisplayName: string;
  orangeDisplayName: string;
}>();
</script>

<template>
  <div class="flex items-center gap-6">
    <PlayerTurnBadge
      color="blue"
      :display-name="blueDisplayName"
      :is-active="currentTurn === 'blue'"
      :turn-label="turnLabel"
    />
    <PlayerTurnBadge
      color="orange"
      :display-name="orangeDisplayName"
      :is-active="currentTurn === 'orange'"
      :turn-label="turnLabel"
    />
  </div>
</template>
