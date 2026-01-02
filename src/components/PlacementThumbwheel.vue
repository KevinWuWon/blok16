<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";

const props = defineProps<{
  placements: Array<{
    anchor: [number, number];
    cells: [number, number][];
    orientationIndex: number;
  }>;
  currentIndex: number;
}>();

const emit = defineEmits<{
  "update:currentIndex": [index: number];
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const thumbwheelRef = ref<HTMLElement | null>(null);
const TICK_HEIGHT = 16;
const TICKS_PER_POSITION = 2;
const isAdjustingScroll = ref(false);
const scrollOrigin = ref(0);
const indexOrigin = ref(0);
const sections = ref(3);
const maxSections = ref(7);

// Get actual container height dynamically
function getContainerHeight(): number {
  return thumbwheelRef.value?.clientHeight ?? 200;
}

// Calculate how many sections to render for scrollability
// Need at least 3x container height of content for infinite scroll to work
function calculateInitialSections(): number {
  if (props.placements.length === 0) return 0;
  const containerHeight = getContainerHeight();
  const minTicks = Math.ceil((containerHeight * 3) / TICK_HEIGHT);
  const ticksPerSection = props.placements.length * TICKS_PER_POSITION;
  const sectionsNeeded = Math.ceil(minTicks / ticksPerSection);
  return Math.max(3, sectionsNeeded); // At least 3 sections
}

const totalTicks = computed(
  () => props.placements.length * sections.value * TICKS_PER_POSITION,
);

const sectionHeight = computed(
  () => props.placements.length * TICK_HEIGHT * TICKS_PER_POSITION,
);

function normalizeIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function resetScrollPosition() {
  if (!scrollContainer.value || props.placements.length === 0) return;
  isAdjustingScroll.value = true;
  // Start one section down so we can grow in both directions.
  scrollContainer.value.scrollTop = sectionHeight.value;
  scrollOrigin.value = scrollContainer.value.scrollTop;
  isAdjustingScroll.value = false;
}

function trimFromTop(height: number) {
  if (!scrollContainer.value) return;
  sections.value -= 1;
  isAdjustingScroll.value = true;
  scrollContainer.value.scrollTop -= height;
  scrollOrigin.value -= height;
  isAdjustingScroll.value = false;
}

function trimFromBottom() {
  sections.value -= 1;
}

function prependSection(height: number) {
  if (!scrollContainer.value) return;
  sections.value += 1;
  isAdjustingScroll.value = true;
  scrollContainer.value.scrollTop += height;
  scrollOrigin.value += height;
  isAdjustingScroll.value = false;

  if (sections.value > maxSections.value) {
    trimFromBottom();
  }
}

function appendSection(height: number) {
  sections.value += 1;
  if (sections.value > maxSections.value) {
    trimFromTop(height);
  }
}

function maybeGrow(scrollTop: number): number {
  if (!scrollContainer.value || props.placements.length === 0) return scrollTop;
  const containerHeight = scrollContainer.value.clientHeight;
  const totalHeight = totalTicks.value * TICK_HEIGHT;
  const height = sectionHeight.value;
  if (height === 0 || totalHeight === 0) return scrollTop;

  // Use a small threshold so a single prepend/append moves us out of the edge zone.
  const threshold = Math.min(containerHeight * 0.5, height);
  if (scrollTop < threshold) {
    prependSection(height);
  } else if (scrollTop + containerHeight > totalHeight - threshold) {
    appendSection(height);
  }

  return scrollContainer.value.scrollTop;
}

function onScroll() {
  if (
    !scrollContainer.value ||
    props.placements.length === 0 ||
    isAdjustingScroll.value
  )
    return;

  let scrollTop = scrollContainer.value.scrollTop;
  console.log(scrollTop)
  scrollTop = maybeGrow(scrollTop);

  // Calculate current index from scroll delta
  const positionDelta = Math.round(
    (scrollTop - scrollOrigin.value) / (TICK_HEIGHT * TICKS_PER_POSITION),
  );
  const newIndex = normalizeIndex(
    indexOrigin.value + positionDelta,
    props.placements.length,
  );

  if (newIndex !== props.currentIndex) {
    emit("update:currentIndex", newIndex);
  }
}

onMounted(() => {
  nextTick(() => {
    const initialSections = calculateInitialSections();
    sections.value = initialSections;
    maxSections.value = Math.max(initialSections + 4, 7);
    nextTick(() => {
      indexOrigin.value = normalizeIndex(
        props.currentIndex,
        props.placements.length,
      );
      resetScrollPosition();
    });
  });
});

watch(
  () => props.currentIndex,
  (newIndex) => {
    indexOrigin.value = normalizeIndex(newIndex, props.placements.length);
    if (scrollContainer.value) {
      scrollOrigin.value = scrollContainer.value.scrollTop;
    }
  },
);

watch(
  () => props.placements.length,
  () => {
    nextTick(() => {
      const initialSections = calculateInitialSections();
      sections.value = initialSections;
      maxSections.value = Math.max(initialSections + 4, 7);
      indexOrigin.value = normalizeIndex(
        props.currentIndex,
        props.placements.length,
      );
      resetScrollPosition();
    });
  },
);
</script>

<template>
  <div
    v-if="placements.length > 1"
    ref="thumbwheelRef"
    class="thumbwheel"
  >
    <div class="thumbwheel-gradient-top" />
    <div class="thumbwheel-gradient-bottom" />
    <div
      ref="scrollContainer"
      class="thumbwheel-scroll"
      @scroll="onScroll"
    >
      <div
        v-for="i in totalTicks"
        :key="i"
        class="thumbwheel-tick"
      />
    </div>
    <div class="thumbwheel-indicator" />
  </div>
</template>

<style scoped>
.thumbwheel {
  position: relative;
  width: 48px;
  height: 100%;
  border-left: 1px solid rgba(128, 128, 128, 0.2);
  border-right: 1px solid rgba(128, 128, 128, 0.2);
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.08) 0%,
    rgba(255, 255, 255, 0.04) 30%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.06) 70%,
    rgba(0, 0, 0, 0.12) 100%
  );
}

.thumbwheel-gradient-top,
.thumbwheel-gradient-bottom {
  position: absolute;
  inset: -2px;
  pointer-events: none;
  z-index: 10;
}

.thumbwheel-gradient-top {
  top: 0;
  background: linear-gradient(
    to bottom,
    var(--ui-bg) 0%,
    transparent 30%
  );
}

.thumbwheel-gradient-bottom {
  bottom: 0;
  background: linear-gradient(
    to top,
    var(--ui-bg) 0%,
    transparent 30%
  );
}

.thumbwheel-scroll {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.thumbwheel-scroll::-webkit-scrollbar {
  display: none;
}

.thumbwheel-tick {
  height: 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  position: relative;
}

.thumbwheel-tick::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(128, 128, 128, 0.35);
  transform: translate(-50%, -50%);
}
</style>
