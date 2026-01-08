<script setup lang="ts">
defineProps<{
  text: string;
  anchorName: string;
  position?: "top" | "bottom" | "left" | "right";
  fallbackPosition?: { bottom?: string; top?: string; left?: string; right?: string };
}>();
</script>

<template>
  <Teleport to="body">
    <div
      class="hint-overlay"
      :class="[`hint-${position ?? 'top'}`]"
      :style="{
        '--anchor': anchorName,
        '--fallback-bottom': fallbackPosition?.bottom,
        '--fallback-top': fallbackPosition?.top,
        '--fallback-left': fallbackPosition?.left ?? '50%',
        '--fallback-right': fallbackPosition?.right,
      }"
    >
      <div class="hint-content">
        <span class="hint-text">{{ text }}</span>
        <div class="hint-arrow" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.hint-overlay {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  animation: hint-fade-in 0.3s ease-out;

  /* Fallback positioning */
  bottom: var(--fallback-bottom, 200px);
  top: var(--fallback-top);
  left: var(--fallback-left, 50%);
  right: var(--fallback-right);
  transform: translateX(-50%);
}

@supports (anchor-name: --x) {
  .hint-overlay {
    position-anchor: var(--anchor);
    bottom: unset;
    top: unset;
    left: unset;
    right: unset;
    transform: none;
  }

  .hint-top {
    position-area: top;
    margin-bottom: 24px;
  }

  .hint-bottom {
    position-area: bottom;
    margin-top: 24px;
  }

  .hint-left {
    position-area: left;
    margin-right: 24px;
  }

  .hint-right {
    position-area: right;
    margin-left: 24px;
  }
}

.hint-content {
  position: relative;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.hint-text {
  display: block;
}

.hint-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 6px solid transparent;
}

/* Arrow positioning based on hint position */
.hint-top .hint-arrow {
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: rgba(0, 0, 0, 0.85);
  border-bottom: none;
}

.hint-bottom .hint-arrow {
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: rgba(0, 0, 0, 0.85);
  border-top: none;
}

.hint-left .hint-arrow {
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: rgba(0, 0, 0, 0.85);
  border-right: none;
}

.hint-right .hint-arrow {
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: rgba(0, 0, 0, 0.85);
  border-left: none;
}

@keyframes hint-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@supports (anchor-name: --x) {
  @keyframes hint-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}

/* Pulse animation for attention */
.hint-content::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.3);
  animation: hint-pulse 2s ease-in-out infinite;
  z-index: -1;
}

@keyframes hint-pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}
</style>
