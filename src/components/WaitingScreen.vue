<script setup lang="ts">
import { useClipboard } from "@vueuse/core";

const props = defineProps<{
  gameUrl: string;
}>();

const { copy, copied } = useClipboard();

function copyLink() {
  copy(props.gameUrl);
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-4">
    <div class="text-center space-y-4 w-full">
      <UIcon
        name="i-lucide-users"
        class="w-12 h-12 mx-auto text-muted"
      />
      <h2 class="text-xl font-semibold">
        Waiting for opponent...
      </h2>
      <p class="text-muted">
        Share this link with a friend:
      </p>
      <div class="flex flex-col items-center gap-2 w-full">
        <UInput
          :value="gameUrl"
          size="xl"
          readonly
          class="w-full text-center"
        />
        <UButton
          size="xl"
          :color="copied ? 'success' : 'neutral'"
          :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
          @click="copyLink"
        >
          {{ copied ? 'Copied!' : 'Copy Link' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
