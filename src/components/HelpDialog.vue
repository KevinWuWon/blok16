<script setup lang="ts">
import { useMediaQuery, createReusableTemplate } from "@vueuse/core";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const isDesktop = useMediaQuery("(min-width: 768px)");
const [DefineContent, ReuseContent] = createReusableTemplate();

function handleOpenChange(value: boolean) {
  emit("update:open", value);
}

function close() {
  emit("update:open", false);
}
</script>

<template>
  <!-- Define rules content once -->
  <DefineContent>
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
  </DefineContent>

  <!-- Desktop: Modal -->
  <UModal
    v-if="isDesktop"
    :open="open"
    title="How to Play"
    @update:open="close"
  >
    <template #body>
      <ReuseContent />
    </template>
    <template #footer>
      <div class="flex justify-end">
        <UButton
          size="xl"
          @click="close"
        >
          Got it
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Mobile: Drawer -->
  <UDrawer
    v-else
    :open="open"
    title="How to Play"
    @update:open="handleOpenChange"
  >
    <template #body>
      <ReuseContent />
    </template>
    <template #footer>
      <UButton
        size="xl"
        block
        @click="close"
      >
        Got it
      </UButton>
    </template>
  </UDrawer>
</template>
