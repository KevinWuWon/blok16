import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(),
    board: v.array(v.array(v.number())),
    players: v.object({
      blue: v.optional(v.string()),
      orange: v.optional(v.string()),
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
});
