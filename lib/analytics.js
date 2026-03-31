export function trackEvent(eventName, properties = {}) {
  if (typeof window === "undefined") return;

  if (typeof window.plausible === "function") {
    window.plausible(eventName, { props: properties });
  }

  if (window.posthog?.capture) {
    window.posthog.capture(eventName, properties);
  }
}

export function identifyUser(user) {
  if (typeof window === "undefined" || !user?.id) return;

  if (window.posthog?.identify) {
    window.posthog.identify(user.id, {
      email: user.email,
    });
  }
}

export function resetAnalyticsIdentity() {
  if (typeof window === "undefined") return;

  if (window.posthog?.reset) {
    window.posthog.reset();
  }
}
