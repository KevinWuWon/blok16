<script setup lang="ts">
defineProps<{
  open: boolean
  currentPlayerName: string
  color: 'blue' | 'orange'
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm() {
  emit('confirm')
  emit('update:open', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    title="Take Over Role?"
    @update:open="handleCancel"
  >
    <template #body>
      <p class="text-sm">
        <strong>{{ currentPlayerName }}</strong> is currently playing as
        <span
          class="font-semibold"
          :class="color === 'blue' ? 'text-blue-500' : 'text-orange-500'"
        >
          {{ color }}
        </span>.
      </p>
      <p class="text-sm text-muted mt-2">
        If you take over, they will no longer be able to play as this color.
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          size="xl"
          variant="ghost"
          @click="handleCancel"
        >
          Cancel
        </UButton>
        <UButton
          size="xl"
          color="warning"
          @click="handleConfirm"
        >
          Take Over
        </UButton>
      </div>
    </template>
  </UModal>
</template>
