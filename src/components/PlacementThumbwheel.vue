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
const TICK_HEIGHT = 20;
const CONTAINER_HEIGHT = 120;
const isScrolling = ref(false);

// Calculate how many times to repeat placements to ensure scrollability
// Need at least 3x container height of content for infinite scroll to work
const repeatCount = computed(() => {
  if (props.placements.length === 0) return 0;
  const minTicks = Math.ceil((CONTAINER_HEIGHT * 3) / TICK_HEIGHT); // ~18 ticks minimum
  const repeatsNeeded = Math.ceil(minTicks / props.placements.length);
  return Math.max(3, repeatsNeeded); // At least 3 repeats
});

const totalTicks = computed(() => props.placements.length * repeatCount.value);

// The "middle section" starts at this offset
const middleSectionStart = computed(() => {
  const sectionsBeforeMiddle = Math.floor(repeatCount.value / 2);
  return sectionsBeforeMiddle * props.placements.length * TICK_HEIGHT;
});

function scrollToIndex(index: number, smooth = false) {
  if (!scrollContainer.value || props.placements.length === 0) return;
  scrollContainer.value.scrollTo({
    top: middleSectionStart.value + index * TICK_HEIGHT,
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

  const scrollTop = scrollContainer.value.scrollTop;
  const sectionHeight = props.placements.length * TICK_HEIGHT;
  const totalHeight = totalTicks.value * TICK_HEIGHT;

  // Reset to middle section if scrolled into first or last quarter
  const lowerBound = sectionHeight;
  const upperBound = totalHeight - sectionHeight * 2;

  if (scrollTop < lowerBound || scrollTop > upperBound) {
    isScrolling.value = true;
    // Jump by one full section toward the middle
    const adjustment = scrollTop < lowerBound ? sectionHeight : -sectionHeight;
    scrollContainer.value.scrollTop = scrollTop + adjustment;
    isScrolling.value = false;
  }

  // Calculate current index from scroll position
  const relativeScroll = scrollTop % sectionHeight;
  const newIndex =
    Math.round(relativeScroll / TICK_HEIGHT) % props.placements.length;

  if (newIndex !== props.currentIndex) {
    emit("update:currentIndex", newIndex);
  }
}

onMounted(() => nextTick(() => scrollToIndex(props.currentIndex)));

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
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.15) 0%,
    rgba(255, 255, 255, 0.05) 30%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 70%,
    rgba(0, 0, 0, 0.15) 100%
  );
}

.thumbwheel-gradient-top,
.thumbwheel-gradient-bottom {
  position: absolute;
  left: 0;
  right: 0;
  height: 40px;
  pointer-events: none;
  z-index: 10;
}

.thumbwheel-gradient-top {
  top: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
}

.thumbwheel-gradient-bottom {
  bottom: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
}

.thumbwheel-scroll {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.thumbwheel-scroll::-webkit-scrollbar {
  display: none;
}

.thumbwheel-tick {
  height: 20px;
  scroll-snap-align: center;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
  position: relative;
}

.thumbwheel-tick::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(128, 128, 128, 0.4);
  transform: translate(-50%, -50%);
}

.thumbwheel-indicator {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 20;
}
</style>
