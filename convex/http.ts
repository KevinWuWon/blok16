import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// HTTP endpoint for service worker to refresh push subscriptions
http.route({
  path: "/push/refresh",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { oldEndpoint, newEndpoint, keys, playerId } = body;

      if (!newEndpoint || !keys || !playerId) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // If we have the old endpoint, remove it first
      if (oldEndpoint) {
        await ctx.runMutation(api.push.unsubscribe, { endpoint: oldEndpoint });
      }

      // Add the new subscription
      await ctx.runMutation(api.push.subscribe, {
        playerId,
        endpoint: newEndpoint,
        keys,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error refreshing push subscription:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;

