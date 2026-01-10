<script setup lang="ts">
defineProps<{
  open: boolean
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

function handleOpenChange(value: boolean) {
  emit('update:open', value)
  if (!value) {
    emit('cancel')
  }
}
</script>

<template>
  <ResponsiveDialog
    :open="open"
    title="Resign?"
    @update:open="handleOpenChange"
  >
    <template #body>
      <p class="text-sm">
        Are you sure you want to resign? Your opponent will win the game.
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          size="xl"
          variant="ghost"
          @click="handleOpenChange(false)"
        >
          Cancel
        </UButton>
        <UButton
          size="xl"
          color="error"
          @click="handleConfirm"
        >
          Resign
        </UButton>
      </div>
    </template>
  </ResponsiveDialog>
</template>
