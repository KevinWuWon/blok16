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
const TICK_WIDTH = 16;
const isScrolling = ref(false);

// Get actual container width dynamically
function getContainerWidth(): number {
  return thumbwheelRef.value?.clientWidth ?? 200;
}

// Calculate how many times to repeat placements to ensure scrollability
// Need at least 3x container height of content for infinite scroll to work
function calculateRepeatCount(): number {
  if (props.placements.length === 0) return 0;
  const containerWidth = getContainerWidth();
  const minTicks = Math.ceil((containerWidth * 3) / TICK_WIDTH);
  const repeatsNeeded = Math.ceil(minTicks / props.placements.length);
  return Math.max(3, repeatsNeeded); // At least 3 repeats
}

const repeatCount = ref(3);

const totalTicks = computed(() => props.placements.length * repeatCount.value);

// The "middle section" starts at this offset
const middleSectionStart = computed(() => {
  const sectionsBeforeMiddle = Math.floor(repeatCount.value / 2);
  return sectionsBeforeMiddle * props.placements.length * TICK_WIDTH;
});

function scrollToIndex(index: number, smooth = false) {
  if (!scrollContainer.value || props.placements.length === 0) return;
  scrollContainer.value.scrollTo({
    left: middleSectionStart.value + index * TICK_WIDTH,
    behavior: smooth ? "smooth" : "instant",
  });
}

function onScroll() {
  if (
    !scrollContainer.value ||
    props.placements.length === 0 ||
    isScrolling.value
  )
    return;

  const scrollLeft = scrollContainer.value.scrollLeft;
  const sectionWidth = props.placements.length * TICK_WIDTH;
  const totalWidth = totalTicks.value * TICK_WIDTH;

  // Reset to middle section if scrolled into first or last quarter
  const lowerBound = sectionWidth;
  const upperBound = totalWidth - sectionWidth * 2;

  if (scrollLeft < lowerBound || scrollLeft > upperBound) {
    isScrolling.value = true;
    // Jump by one full section toward the middle
    const adjustment = scrollLeft < lowerBound ? sectionWidth : -sectionWidth;
    scrollContainer.value.scrollLeft = scrollLeft + adjustment;
    isScrolling.value = false;
  }

  // Calculate current index from scroll position
  const relativeScroll = scrollLeft % sectionWidth;
  const newIndex =
    Math.round(relativeScroll / TICK_WIDTH) % props.placements.length;

  if (newIndex !== props.currentIndex) {
    emit("update:currentIndex", newIndex);
  }
}

onMounted(() => {
  nextTick(() => {
    repeatCount.value = calculateRepeatCount();
    nextTick(() => scrollToIndex(props.currentIndex));
  });
});

watch(
  () => props.currentIndex,
  (newIndex) => {
    scrollToIndex(newIndex, true);
  },
);

watch(
  () => props.placements.length,
  () => {
    nextTick(() => scrollToIndex(props.currentIndex));
  },
);
</script>

<template>
  <div
    v-if="placements.length > 1"
    ref="thumbwheelRef"
    class="thumbwheel"
  >
    <div class="thumbwheel-gradient-left" />
    <div class="thumbwheel-gradient-right" />
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
  </div>
</template>

<style scoped>
.thumbwheel {
  position: relative;
  width: 100%;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
}

.thumbwheel-gradient-left,
.thumbwheel-gradient-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30%;
  pointer-events: none;
  z-index: 10;
}

.thumbwheel-gradient-left {
  left: 0;
  background: linear-gradient(
    to right,
    var(--ui-bg) 0%,
    transparent 100%
  );
}

.thumbwheel-gradient-right {
  right: 0;
  background: linear-gradient(
    to left,
    var(--ui-bg) 0%,
    transparent 100%
  );
}

.thumbwheel-scroll {
  width: 100%;
  height: 100%;
  overflow-x: scroll;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display: flex;
  flex-direction: row;
}

.thumbwheel-scroll::-webkit-scrollbar {
  display: none;
}

.thumbwheel-tick {
  width: 16px;
  scroll-snap-align: center;
  border-right: 1px solid rgba(128, 128, 128, 0.2);
  position: relative;
  flex: 0 0 auto;
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
