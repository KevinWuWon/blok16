<script setup lang="ts">
import type { DerivedUIState } from "@/composables/useGameFlow";
import GameOverflowMenu from "@/components/GameOverflowMenu.vue";

defineProps<{
  code: string;
  notificationsSupported: boolean;
  bellIcon: string;
  derivedUIState: DerivedUIState;
  isSpectator: boolean;
  gameStatus: "waiting" | "playing" | "finished";
}>();

const emit = defineEmits<{
  helpClick: [];
  notificationClick: [];
  roleClick: [];
  menuResign: [];
}>();
</script>

<template>
  <header
    class="flex items-center justify-between px-4 py-2 border-b border-default shrink-0"
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
        v-if="isSpectator"
        variant="ghost"
        size="xl"
        icon="i-lucide-user"
        title="Change role"
        @click="emit('roleClick')"
      />
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
      <GameOverflowMenu
        :disabled="isSpectator || gameStatus !== 'playing'"
        @resign="emit('menuResign')"
      />
    </div>
  </header>
</template>
