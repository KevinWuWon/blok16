import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// Store a push subscription for a player
export const subscribe = mutation({
  args: {
    playerId: v.string(),
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    gameCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if this exact subscription already exists
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      // Update existing subscription with new game code if provided
      await ctx.db.patch(existing._id, {
        playerId: args.playerId,
        gameCode: args.gameCode,
        keys: args.keys,
      });
      return existing._id;
    }

    // Create new subscription
    return await ctx.db.insert("pushSubscriptions", {
      playerId: args.playerId,
      endpoint: args.endpoint,
      keys: args.keys,
      gameCode: args.gameCode,
      createdAt: Date.now(),
    });
  },
});

// Remove a push subscription
export const unsubscribe = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (subscription) {
      await ctx.db.delete(subscription._id);
    }
  },
});

// Update the game code for a subscription
export const updateGameCode = mutation({
  args: {
    playerId: v.string(),
    gameCode: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .collect();

    for (const sub of subscriptions) {
      await ctx.db.patch(sub._id, { gameCode: args.gameCode });
    }
  },
});

// Check if a player has push enabled
export const hasSubscription = query({
  args: {
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .first();
    return !!subscription;
  },
});

// Check if a specific endpoint (device) is registered for a player
export const hasSubscriptionForEndpoint = query({
  args: {
    endpoint: v.string(),
    playerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (!subscription) {
      return false;
    }
    if (args.playerId && subscription.playerId !== args.playerId) {
      return false;
    }
    return true;
  },
});

// Internal query to get subscriptions for a player
export const getSubscriptionsForPlayer = internalQuery({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .collect();
  },
});

// Internal mutation to remove a subscription (for cleanup when push fails)
export const removeSubscription = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (subscription) {
      await ctx.db.delete(subscription._id);
    }
  },
});
