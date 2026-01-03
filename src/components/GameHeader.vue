<script setup lang="ts">
import type { DerivedUIState } from "@/composables/useGameFlow";

defineProps<{
  code: string;
  notificationsSupported: boolean;
  bellIcon: string;
  derivedUIState: DerivedUIState;
}>();

const emit = defineEmits<{
  helpClick: [];
  notificationClick: [];
}>();
</script>

<template>
  <header
    class="items-center justify-between px-4 py-2 border-b border-default shrink-0"
    :class="derivedUIState === 'browsing' ? 'hidden md:flex' : 'flex'"
  >
    <div class="flex items-center gap-2">
      <RouterLink
        to="/"
        class="text-lg font-bold"
      >
        Blokli
      </RouterLink>
      <UBadge
        variant="subtle"
        color="neutral"
      >
        {{ code }}
      </UBadge>
    </div>
    <div class="flex items-center gap-2">
      <UButton
        variant="ghost"
        size="xl"
        icon="i-lucide-circle-help"
        title="How to play"
        @click="emit('helpClick')"
      />
      <UButton
        v-if="notificationsSupported"
        variant="ghost"
        size="xl"
        :icon="bellIcon"
        title="Notification settings"
        @click="emit('notificationClick')"
      />
    </div>
  </header>
</template>
