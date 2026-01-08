<script setup lang="ts">
defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "reset-hints"): void;
}>();

function handleResetHints() {
  emit("reset-hints");
}
</script>

<template>
  <ResponsiveDialog
    :open="open"
    title="How to Play"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 text-sm">
        <section>
          <h4 class="font-semibold mb-1">
            Goal
          </h4>
          <p class="text-muted">
            Place as many of your pieces as possible. The player with the fewest remaining squares wins.
          </p>
        </section>

        <section>
          <h4 class="font-semibold mb-1">
            First Move
          </h4>
          <p class="text-muted">
            Your first piece must cover your starting corner. Blue starts near the top-left, Orange near the bottom-right.
          </p>
        </section>

        <section>
          <h4 class="font-semibold mb-1">
            Placing Pieces
          </h4>
          <p class="text-muted">
            Each new piece must touch one of your existing pieces <strong class="text-default">diagonally</strong> (corner-to-corner). Pieces may <strong class="text-default">never</strong> touch your own pieces edge-to-edge.
          </p>
        </section>

        <section>
          <h4 class="font-semibold mb-1">
            Passing
          </h4>
          <p class="text-muted">
            If you cannot legally place any piece, you must pass your turn.
          </p>
        </section>

        <section>
          <h4 class="font-semibold mb-1">
            Game Over
          </h4>
          <p class="text-muted">
            The game ends when both players pass consecutively. The player with fewer remaining squares wins. If tied, it's a draw.
          </p>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="space-y-3">
        <UButton
          size="xl"
          block
          @click="emit('update:open', false)"
        >
          Got it
        </UButton>
        <button
          class="w-full text-sm text-muted hover:text-default transition-colors"
          @click="handleResetHints"
        >
          Show tutorial hints again
        </button>
      </div>
    </template>
  </ResponsiveDialog>
</template>
