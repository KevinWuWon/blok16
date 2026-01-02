<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";
import type { DerivedUIState } from "@/composables/useGameFlow";
import PieceMiniPreview from "./PieceMiniPreview.vue";

defineProps<{
  derivedUIState: DerivedUIState;
  selectedPieceId: number | null;
  myColor: PlayerColor | null;
  currentOrientationIndex: number;
  previewCells: [number, number][] | null;
  canPass: boolean;
  interactionType: "idle" | "browsing" | "placing";
}>();

const emit = defineEmits<{
  openTray: [tab: "mine" | "opponent"];
  closeTray: [];
  rotate: [direction: "cw" | "ccw"];
  flip: [];
  confirm: [];
  deselect: [];
  changePiece: [];
  pass: [];
  clearPreview: [];
}>();
</script>

<template>
  <footer class="border-t border-default p-4 lg:py-2 shrink-0">
    <div class="flex items-center justify-center gap-2 flex-wrap">
      <!-- Mobile: Select piece button (idle state) -->
      <UButton
        v-if="derivedUIState === 'my_turn'"
        size="xl"
        class="md:hidden"
        @click="emit('openTray', 'mine')"
      >
        Select Piece
      </UButton>

      <!-- Mobile: Hide tray button (browsing state) -->
      <UButton
        v-if="derivedUIState === 'browsing' || derivedUIState === 'game_over_browsing'"
        size="xl"
        class="md:hidden"
        variant="outline"
        @click="emit('closeTray')"
      >
        Hide
      </UButton>

      <!-- Mobile: View Pieces button (watching/finished state) -->
      <UButton
        v-if="derivedUIState === 'opponent_turn' || derivedUIState === 'game_over'"
        class="md:hidden"
        variant="outline"
        size="xl"
        @click="emit('openTray', 'mine')"
      >
        View Pieces
      </UButton>

      <!-- Desktop: Selected piece controls (hidden on mobile when placing) -->
      <template v-if="selectedPieceId !== null">
        <div
          class="flex items-center gap-1"
          :class="{ 'hidden md:flex': derivedUIState === 'placing' }"
        >
          <PieceMiniPreview
            :piece-id="selectedPieceId"
            :player-color="myColor || 'blue'"
            :orientation-index="currentOrientationIndex"
            class="w-10 h-10"
          />
        </div>
        <div
          class="flex items-center gap-1"
          :class="{ 'hidden md:flex': derivedUIState === 'placing' }"
        >
          <UButton
            icon="i-lucide-rotate-ccw"
            variant="outline"
            size="xl"
            title="Rotate (R)"
            @click="emit('rotate', 'ccw')"
          />
          <UButton
            icon="i-lucide-rotate-cw"
            variant="outline"
            size="xl"
            title="Rotate (R)"
            @click="emit('rotate', 'cw')"
          />
          <UButton
            icon="i-lucide-flip-horizontal"
            variant="outline"
            size="xl"
            title="Flip (F)"
            @click="emit('flip')"
          />
        </div>

        <!-- Confirm/Cancel when preview is active (desktop only) -->
        <template v-if="previewCells">
          <UButton
            size="xl"
            color="primary"
            :class="{ 'hidden md:inline-flex': derivedUIState === 'placing' }"
            @click="emit('confirm')"
          >
            Confirm
          </UButton>
          <UButton
            size="xl"
            variant="outline"
            :class="{ 'hidden md:inline-flex': derivedUIState === 'placing' }"
            @click="emit('clearPreview')"
          >
            Cancel
          </UButton>
        </template>

        <!-- Change piece button (tablet only, hidden on mobile and lg+) -->
        <UButton
          v-if="!previewCells && interactionType === 'placing'"
          variant="ghost"
          size="xl"
          class="hidden md:inline-flex lg:hidden"
          @click="emit('changePiece')"
        >
          Change
        </UButton>
        <UButton
          v-if="!previewCells"
          variant="ghost"
          size="xl"
          :class="{ 'hidden md:inline-flex': derivedUIState === 'placing' }"
          @click="emit('deselect')"
        >
          Deselect
        </UButton>
      </template>

      <!-- Pass button -->
      <UButton
        v-if="canPass && !previewCells"
        size="xl"
        variant="outline"
        color="warning"
        @click="emit('pass')"
      >
        Pass Turn
      </UButton>
    </div>
  </footer>
</template>
