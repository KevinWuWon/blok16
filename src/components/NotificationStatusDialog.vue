<script setup lang="ts">
import { ref, computed } from "vue";
import { useNotifications } from "@/composables/useNotifications";

type NotificationStatus =
  | "unsupported"
  | "denied"
  | "not-setup"
  | "not-registered"
  | "working";

const props = defineProps<{
  open: boolean;
  playerId: string;
  gameCode: string;
  status: NotificationStatus;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "subscribe", subscription: PushSubscription): void;
}>();

const {
  subscribeToPush,
} = useNotifications();

const isLoading = ref(false);
const isPlayerReady = computed(() => props.playerId.trim().length > 0);
const status = computed(() => props.status);

const statusConfig = computed(() => {
  switch (status.value) {
    case "unsupported":
      return {
        icon: "i-lucide-bell-off",
        iconClass: "text-neutral-400",
        title: "Not Supported",
        description: "Push notifications are not supported in this browser.",
        actionLabel: null,
      };
    case "denied":
      return {
        icon: "i-lucide-bell-off",
        iconClass: "text-red-500",
        title: "Notifications Blocked",
        description:
          "Notifications are blocked. Enable them in your browser settings, then return here.",
        actionLabel: null,
      };
    case "not-setup":
      return {
        icon: "i-lucide-bell",
        iconClass: "text-neutral-400",
        title: "Notifications Disabled",
        description:
          "Enable notifications to get alerted when it's your turn.",
        actionLabel: "Enable Notifications",
      };
    case "not-registered":
      return {
        icon: "i-lucide-bell-plus",
        iconClass: "text-amber-500",
        title: "Device Not Registered",
        description:
          "Notifications are enabled, but this device isn't registered for this game. Register to receive turn alerts.",
        actionLabel: "Register This Device",
      };
    case "working":
    default:
      return {
        icon: "i-lucide-bell-ring",
        iconClass: "text-green-500",
        title: "Notifications Active",
        description:
          "You'll receive a notification when it's your turn.",
        actionLabel: null,
      };
  }
});

const showPushWarning = computed(() => status.value === "unsupported");

async function handleAction() {
  if (!isPlayerReady.value) {
    return;
  }
  isLoading.value = true;
  try {
    const subscription = await subscribeToPush();
    if (subscription) {
      emit("subscribe", subscription);
    }
  } finally {
    isLoading.value = false;
  }
}

function handleOpenChange(value: boolean) {
  emit("update:open", value);
}
</script>

<template>
  <ResponsiveDialog
    :open="open"
    title="Notifications"
    @update:open="handleOpenChange"
  >
    <template #body>
      <div class="flex flex-col items-center text-center py-4 space-y-4">
        <div
          v-if="showPushWarning"
          class="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100"
        >
          <div class="flex items-start gap-2">
            <UIcon
              name="i-lucide-triangle-alert"
              class="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-300"
            />
            <div class="space-y-1">
              <p class="font-semibold">
                Push not supported here
              </p>
              <p class="text-amber-800/90 dark:text-amber-100/80">
                Notifications only work in supported browsers. If you're on iOS, install to Home Screen and open from the app icon.
              </p>
            </div>
          </div>
        </div>
        <!-- Status Icon -->
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center"
          :class="[
            status === 'working' ? 'bg-green-100 dark:bg-green-900/30' :
            status === 'denied' ? 'bg-red-100 dark:bg-red-900/30' :
            status === 'not-registered' ? 'bg-amber-100 dark:bg-amber-900/30' :
            'bg-neutral-100 dark:bg-neutral-800'
          ]"
        >
          <UIcon
            :name="statusConfig.icon"
            :class="['w-8 h-8', statusConfig.iconClass]"
          />
        </div>

        <!-- Status Text -->
        <div class="space-y-2">
          <h3 class="text-lg font-semibold">
            {{ statusConfig.title }}
          </h3>
          <p class="text-sm text-muted max-w-xs">
            {{ statusConfig.description }}
          </p>
        </div>

        <!-- Action Button -->
        <UButton
          v-if="statusConfig.actionLabel"
          size="xl"
          :loading="isLoading"
          :disabled="!isPlayerReady"
          @click="handleAction"
        >
          {{ statusConfig.actionLabel }}
        </UButton>
        <p
          v-if="statusConfig.actionLabel && !isPlayerReady"
          class="text-xs text-muted"
        >
          Loading device identity. Please try again in a moment.
        </p>

        <!-- Done button when working -->
        <UButton
          v-if="status === 'working'"
          size="xl"
          variant="outline"
          @click="handleOpenChange(false)"
        >
          Done
        </UButton>
      </div>
    </template>
  </ResponsiveDialog>
</template>
