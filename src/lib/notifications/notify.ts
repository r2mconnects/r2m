import { db } from "@/db";
import { notifications } from "@/db/schema";

/** Which external channels are configured. In-app is always available. */
export function channelStatus() {
  return {
    in_app: true,
    email: Boolean(process.env.EMAIL_PROVIDER_API_KEY),
    sms: Boolean(process.env.SMS_PROVIDER_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_PROVIDER_TOKEN),
  };
}

export async function notify(userId: string | null | undefined, title: string, body?: string, link?: string, kind = "general") {
  if (!userId) return;
  const ch = channelStatus();
  const delivery: Record<string, string> = {
    in_app: "delivered",
    email: ch.email ? "queued" : "not_configured",
    sms: ch.sms ? "queued" : "not_configured",
    whatsapp: ch.whatsapp ? "queued" : "not_configured",
  };
  try {
    await db.insert(notifications).values({ userId, title, body, link, kind, channelStatus: delivery });
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function notifyMany(userIds: string[], title: string, body?: string, link?: string, kind = "general") {
  if (!userIds.length) return;
  const ch = channelStatus();
  const delivery: Record<string, string> = {
    in_app: "delivered",
    email: ch.email ? "queued" : "not_configured",
    sms: ch.sms ? "queued" : "not_configured",
    whatsapp: ch.whatsapp ? "queued" : "not_configured",
  };
  for (let i = 0; i < userIds.length; i += 500) {
    await db
      .insert(notifications)
      .values(userIds.slice(i, i + 500).map((userId) => ({ userId, title, body, link, kind, channelStatus: delivery })));
  }
}
