import { createConvexVue } from "@convex-vue/core";

// Prefix with 01. to ensure this plugin loads first
export default defineNuxtPlugin({
  name: 'convex',
  enforce: 'pre', // Run before other plugins
  setup(nuxtApp) {
    const config = useRuntimeConfig();
    const convexUrl = config.public.convexUrl as string;

    if (!convexUrl) {
      console.error("NUXT_PUBLIC_CONVEX_URL not set! Convex will not work.");
      console.error("Run 'npx convex dev' and add NUXT_PUBLIC_CONVEX_URL to your .env file");
    }

    const convexVue = createConvexVue({
      convexUrl: convexUrl || "https://placeholder.convex.cloud"
    });

    nuxtApp.vueApp.use(convexVue);
  }
});
