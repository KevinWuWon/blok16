<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";

defineProps<{
  winner: PlayerColor | "draw";
  myColor: PlayerColor | null;
}>();
</script>

<template>
  <div class="text-2xl font-bold text-center flex justify-between items-center">
    <div>
      <span
        v-if="winner === 'draw'"
      >Draw!</span>
      <span
        v-else
      >
        {{ winner === myColor ? "You won!" : "You lost!" }}
      </span>
    </div>
    <div>
      <slot />
    </div>
  </div>
</template>
