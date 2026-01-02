<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";

defineProps<{
  winner: PlayerColor | "draw";
  myColor: PlayerColor | null;
}>();
</script>

<template>
  <div class="text-2xl font-bold text-center">
    <span
      v-if="winner === 'draw'"
      class="text-muted"
    >Draw!</span>
    <span
      v-else
      :class="
        winner === 'blue'
          ? 'text-blue-500'
          : 'text-orange-500'
      "
    >
      {{ winner === myColor ? "You win!" : "You lose!" }}
    </span>
  </div>
  <slot />
</template>
