import { ref, readonly } from "vue";

export type NotificationPermission =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

const permissionState = ref<NotificationPermission>("default");
const pushSubscription = ref<PushSubscription | null>(null);
const serviceWorkerRegistration = ref<ServiceWorkerRegistration | null>(null);

function checkSupport(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function checkPushSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function updatePermissionState() {
  if (!checkSupport()) {
    permissionState.value = "unsupported";
    return;
  }
  permissionState.value = Notification.permission as NotificationPermission;
}

// Initialize on module load
if (typeof window !== "undefined") {
  updatePermissionState();
}

export function useNotifications() {
  // Ensure we have the latest permission state
  updatePermissionState();

  async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!checkPushSupport()) {
      return null;
    }

    try {
      // Check if already registered
      if (serviceWorkerRegistration.value) {
        return serviceWorkerRegistration.value;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      serviceWorkerRegistration.value = registration;
      return registration;
    } catch (error) {
      console.error("Service worker registration failed:", error);
      return null;
    }
  }

  async function requestPermission(): Promise<boolean> {
    if (!checkSupport()) {
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      permissionState.value = result as NotificationPermission;
      return result === "granted";
    } catch {
      return false;
    }
  }

  async function subscribeToPush(): Promise<PushSubscription | null> {
    if (!checkPushSupport()) {
      console.log("Push notifications not supported");
      return null;
    }

    // First, request notification permission
    const granted = await requestPermission();
    if (!granted) {
      console.log("Notification permission not granted");
      return null;
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      console.error("Could not register service worker");
      return null;
    }

    try {
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        pushSubscription.value = subscription;
        return subscription;
      }

      // Get VAPID public key from environment
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error("VAPID public key not configured");
        return null;
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      pushSubscription.value = subscription;
      return subscription;
    } catch (error) {
      console.error("Push subscription failed:", error);
      return null;
    }
  }

  async function unsubscribeFromPush(): Promise<boolean> {
    if (!pushSubscription.value) {
      return true;
    }

    try {
      await pushSubscription.value.unsubscribe();
      pushSubscription.value = null;
      return true;
    } catch (error) {
      console.error("Push unsubscription failed:", error);
      return false;
    }
  }

  async function getExistingSubscription(): Promise<PushSubscription | null> {
    if (!checkPushSupport()) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      serviceWorkerRegistration.value = registration;
      const subscription = await registration.pushManager.getSubscription();
      pushSubscription.value = subscription;
      return subscription;
    } catch {
      return null;
    }
  }

  async function getCurrentEndpoint(): Promise<string | null> {
    const subscription = await getExistingSubscription();
    return subscription?.endpoint ?? null;
  }

  /**
   * Store player info in the service worker for subscription refresh handling.
   * Call this after successfully registering a push subscription.
   */
  function storePlayerInfoForServiceWorker(
    playerId: string,
    convexUrl: string,
  ) {
    if (!checkPushSupport()) return;

    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: "STORE_PLAYER_ID",
        playerId,
        convexUrl,
      });
    });
  }

  const isSupported = checkSupport();
  const isPushSupported = checkPushSupport();
  const canRequest = isSupported && permissionState.value !== "denied";
  const isEnabled = isSupported && permissionState.value === "granted";

  return {
    permission: readonly(permissionState),
    pushSubscription: readonly(pushSubscription),
    isSupported,
    isPushSupported,
    canRequest,
    isEnabled,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    getExistingSubscription,
    getCurrentEndpoint,
    registerServiceWorker,
    storePlayerInfoForServiceWorker,
    updatePermissionState,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to extract subscription data for sending to backend
export function getSubscriptionData(subscription: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} | null {
  const key = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");

  if (!key || !auth) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(key),
      auth: arrayBufferToBase64(auth),
    },
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
