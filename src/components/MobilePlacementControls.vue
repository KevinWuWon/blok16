<script setup lang="ts">
import type { PlayerColor } from "../../lib/validation";
import PieceMiniPreview from "./PieceMiniPreview.vue";
import PlacementThumbwheel from "./PlacementThumbwheel.vue";

defineProps<{
  selectedPieceId: number;
  playerColor: PlayerColor;
  currentOrientationIndex: number;
  allValidPlacements: { anchor: [number, number]; cells: [number, number][]; orientationIndex: number }[];
  currentPlacementIndex: number;
}>();

const emit = defineEmits<{
  changePiece: [];
  rotate: [direction: "cw" | "ccw"];
  flip: [];
  confirm: [];
  placementIndexChange: [index: number];
}>();
</script>

<template>
  <div class="flex-1 flex items-center justify-center mt-2 p-4 gap-3">
    <div class="flex flex-col gap-3 max-w-sm mx-auto">
      <!-- Preview + manipulation row -->
      <div class="flex items-center justify-center gap-3">
        <PieceMiniPreview
          :piece-id="selectedPieceId"
          :player-color="playerColor"
          :orientation-index="currentOrientationIndex"
          class="w-12 h-12"
          @click="emit('changePiece')"
        />
        <UButton
          icon="i-lucide-arrow-down-up"
          size="xl"
          variant="outline"
          title="Change Piece"
          @click="emit('changePiece')"
        />
        <UButton
          icon="i-lucide-check"
          size="xl"
          title="Confirm"
          @click="emit('confirm')"
        />
      </div>
      <div class="flex items-center justify-center gap-3">
        <UButton
          icon="i-lucide-rotate-ccw"
          size="xl"
          variant="outline"
          title="Rotate counter-clockwise"
          @click="emit('rotate', 'ccw')"
        />
        <UButton
          icon="i-lucide-rotate-cw"
          size="xl"
          variant="outline"
          title="Rotate clockwise (R)"
          @click="emit('rotate', 'cw')"
        />
        <UButton
          icon="i-lucide-flip-horizontal"
          size="xl"
          variant="outline"
          title="Flip (F)"
          @click="emit('flip')"
        />
      </div>
    </div>

    <!-- Thumbwheel for cycling through placements -->
    <div class="w-12 h-28 relative">
      <PlacementThumbwheel
        :placements="allValidPlacements"
        :current-index="currentPlacementIndex"
        @update:current-index="emit('placementIndexChange', $event)"
      />
    </div>
  </div>
</template>
