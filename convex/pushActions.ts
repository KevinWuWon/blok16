"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// Action to send push notification (runs in Node.js environment)
export const sendPushNotification = action({
  args: {
    playerId: v.string(),
    title: v.string(),
    body: v.string(),
    gameCode: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all subscriptions for this player
    const subscriptions = await ctx.runQuery(internal.push.getSubscriptionsForPlayer, {
      playerId: args.playerId,
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Get VAPID keys from environment
    const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_CONTACT_EMAIL || "mailto:admin@example.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured");
      return { sent: 0, failed: 0, error: "VAPID keys not configured" };
    }

    // Dynamic import of web-push
    const webpush = await import("web-push");

    webpush.default.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: args.tag || "blokli-notification",
      data: {
        gameCode: args.gameCode,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.default.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
        sent++;
      } catch (error: unknown) {
        console.error("Push failed for endpoint:", sub.endpoint, error);
        failed++;

        // If subscription is expired or invalid, remove it
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(internal.push.removeSubscription, {
            endpoint: sub.endpoint,
          });
        }
      }
    }

    return { sent, failed };
  },
});

