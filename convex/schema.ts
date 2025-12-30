import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(),
    board: v.array(v.array(v.number())),
    players: v.object({
      blue: v.optional(v.union(
        v.string(),  // Legacy UUID only
        v.object({ id: v.string(), name: v.string() })
      )),
      orange: v.optional(v.union(
        v.string(),
        v.object({ id: v.string(), name: v.string() })
      )),
    }),
    pieces: v.object({
      blue: v.array(v.number()),
      orange: v.array(v.number()),
    }),
    currentTurn: v.union(v.literal("blue"), v.literal("orange")),
    status: v.union(v.literal("waiting"), v.literal("playing"), v.literal("finished")),
    winner: v.union(v.literal("blue"), v.literal("orange"), v.literal("draw"), v.null()),
    lastPassedBy: v.union(v.literal("blue"), v.literal("orange"), v.null()),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  // Push notification subscriptions
  pushSubscriptions: defineTable({
    playerId: v.string(),
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    createdAt: v.number(),
    // Track which game codes this subscription is interested in
    gameCode: v.optional(v.string()),
  })
    .index("by_player", ["playerId"])
    .index("by_endpoint", ["endpoint"])
    .index("by_game", ["gameCode"]),
});
