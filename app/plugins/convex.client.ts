import { createConvexVue } from "@convex-vue/core";
import { ConvexClient } from "convex/browser";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const convexUrl = config.public.convexUrl as string;

  if (!convexUrl) {
    console.warn("NUXT_PUBLIC_CONVEX_URL not set, Convex client not initialized");
    return;
  }

  const client = new ConvexClient(convexUrl);
  const convexVue = createConvexVue({ client });

  nuxtApp.vueApp.use(convexVue);
});
