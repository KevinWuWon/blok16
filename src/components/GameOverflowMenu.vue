<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed } from 'vue'

const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  (e: 'resign'): void
}>()

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: '(╯°□°)╯︵ ┻━┻',
      icon: 'i-lucide-flag',
      disabled: props.disabled,
      onSelect: () => emit('resign'),
    },
  ],
])
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      variant="ghost"
      size="xl"
      icon="i-lucide-ellipsis-vertical"
      title="More options"
    />
  </UDropdownMenu>
</template>
