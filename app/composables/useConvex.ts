import { ConvexClient } from "convex/browser";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";

export function useConvexClient(): ConvexClient {
  const nuxtApp = useNuxtApp();
  const client = nuxtApp.$convexClient as ConvexClient | undefined;
  if (!client) {
    throw new Error("Convex client not available. Make sure NUXT_PUBLIC_CONVEX_URL is set.");
  }
  return client;
}

export function useConvexQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: () => FunctionArgs<Query>
) {
  const client = useConvexClient();
  const data = ref<FunctionReturnType<Query> | undefined>(undefined);
  const isLoading = ref(true);
  const error = ref<Error | null>(null);

  let unsubscribe: (() => void) | null = null;

  const subscribe = () => {
    if (unsubscribe) {
      unsubscribe();
    }

    try {
      const queryArgs = args();
      unsubscribe = client.onUpdate(query, queryArgs, (result) => {
        data.value = result;
        isLoading.value = false;
        error.value = null;
      });
    } catch (e) {
      error.value = e as Error;
      isLoading.value = false;
    }
  };

  onMounted(() => {
    subscribe();
  });

  // Re-subscribe when args change
  watch(args, () => {
    subscribe();
  }, { deep: true });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  return { data, isLoading, error };
}

export function useConvexMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation
) {
  const client = useConvexClient();
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const mutate = async (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation> | null> => {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await client.mutation(mutation, args);
      isLoading.value = false;
      return result;
    } catch (e) {
      error.value = e as Error;
      isLoading.value = false;
      return null;
    }
  };

  return { mutate, isLoading, error };
}
