<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";

defineProps<{
  color: PlayerColor;
  displayName: string;
  isActive: boolean;
  turnLabel: string;
  showNudge?: boolean;
  isNudging?: boolean;
}>();

const emit = defineEmits<{
  nudge: [];
}>();
</script>

<template>
  <div
    class="relative px-2 py-1 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
    :class="[
      isActive
        ? color === 'blue'
          ? 'border-blue-500'
          : 'border-orange-500'
        : 'border-transparent opacity-50',
    ]"
  >
    <span
      v-if="isActive"
      class="absolute -top-2 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider whitespace-nowrap"
      :class="color === 'blue' ? 'text-blue-500' : 'text-orange-500'"
    >
      {{ turnLabel }}
    </span>
    <span
      class="font-bold text-lg inline-flex items-center gap-1"
      :class="[
        color === 'blue'
          ? isActive
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-blue-500'
          : isActive
            ? 'text-orange-600 dark:text-orange-400'
            : 'text-orange-500',
      ]"
    >
      {{ displayName }}
      <UButton
        v-if="showNudge"
        size="2xs"
        variant="ghost"
        icon="i-lucide-hand"
        :loading="isNudging"
        class="ml-1"
        @click.stop="emit('nudge')"
      />
    </span>
  </div>
</template>
