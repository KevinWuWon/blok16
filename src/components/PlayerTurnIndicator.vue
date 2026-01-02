<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";

defineProps<{
  currentTurn: PlayerColor;
  turnLabel: string;
  blueDisplayName: string;
  orangeDisplayName: string;
}>();
</script>

<template>
  <div class="flex items-center gap-6">
    <!-- Blue Player -->
    <div
      class="relative px-4 py-2 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
      :class="
        currentTurn === 'blue'
          ? 'border-blue-500'
          : 'border-transparent opacity-50'
      "
    >
      <span
        v-if="currentTurn === 'blue'"
        class="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider text-blue-500 whitespace-nowrap"
      >
        {{ turnLabel }}
      </span>
      <span
        class="font-bold text-lg"
        :class="
          currentTurn === 'blue'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-blue-500'
        "
      >{{ blueDisplayName }}</span>
    </div>

    <!-- Orange Player -->
    <div
      class="relative px-4 py-2 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
      :class="
        currentTurn === 'orange'
          ? 'border-orange-500'
          : 'border-transparent opacity-50'
      "
    >
      <span
        v-if="currentTurn === 'orange'"
        class="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider text-orange-500 whitespace-nowrap"
      >
        {{ turnLabel }}
      </span>
      <span
        class="font-bold text-lg"
        :class="
          currentTurn === 'orange'
            ? 'text-orange-600 dark:text-orange-400'
            : 'text-orange-500'
        "
      >{{ orangeDisplayName }}</span>
    </div>
  </div>
</template>
