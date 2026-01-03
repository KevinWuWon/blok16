<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    dismissible?: boolean;
  }>(),
  {
    dismissible: true,
  }
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const isDesktop = useMediaQuery("(min-width: 768px)");

function handleOpenChange(value: boolean) {
  // Only emit if the value is actually changing (avoid loops from UDrawer emitting on open)
  if (value !== props.open) {
    emit("update:open", value);
  }
}
</script>

<template>
  <!-- Desktop: Modal -->
  <UModal
    v-if="isDesktop"
    :open="open"
    :title="title"
    :dismissible="dismissible"
    @update:open="handleOpenChange"
  >
    <template #body>
      <slot name="body" />
    </template>
    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UModal>

  <!-- Mobile: Drawer -->
  <UDrawer
    v-else
    :open="open"
    :title="title"
    :dismissible="dismissible"
    @update:open="handleOpenChange"
  >
    <template #body>
      <slot name="body" />
    </template>
    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UDrawer>
</template>
