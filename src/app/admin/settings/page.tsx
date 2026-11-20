import { saveSettingsAction } from "@/actions/settings.actions";
import { Checkbox, Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/controls";
import { Flash, PageHeader, StatusBadge } from "@/components/shared/ui";
import { requirePermission } from "@/lib/auth/session";
import { channelStatus } from "@/lib/notifications/notify";
import { razorpayConfigured } from "@/lib/payments/razorpay";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  await requirePermission("settings", "view");
  const s = await getSettings();
  const ch = channelStatus();
  const integrations: Array<[string, boolean, string]> = [
    ["Razorpay (payments)", razorpayConfigured(), "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET"],
    ["Razorpay webhook", Boolean(process.env.RAZORPAY_WEBHOOK_SECRET), "RAZORPAY_WEBHOOK_SECRET → POST /api/payments/webhook"],
    ["SMS provider", ch.sms, "SMS_PROVIDER_API_KEY"],
    ["WhatsApp Business", ch.whatsapp, "WHATSAPP_PROVIDER_TOKEN"],
    ["Email provider", ch.email, "EMAIL_PROVIDER_API_KEY"],
    ["Scheduled reminders", Boolean(process.env.CRON_SECRET), "CRON_SECRET → GET /api/notifications/cron"],
  ];
  return (
    <>
      <PageHeader title="Application Settings" crumbs={[{ label: "Settings" }]} />
      <Flash sp={sp} />
      <form action={saveSettingsAction} className="space-y-4">
        <section className="card grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-bold text-navy sm:col-span-2">Association</h2>
          <Field label="Association name" name="associationName" defaultValue={s.associationName} className="sm:col-span-2" />
          <Field label="App name" name="shortName" defaultValue={s.shortName} />
          <Field label="Tagline" name="tagline" defaultValue={s.tagline} />
          <Field label="Contact phone" name="contactPhone" defaultValue={s.contactPhone} />
          <Field label="Contact email" name="contactEmail" defaultValue={s.contactEmail} />
          <Field label="Office address" name="contactAddress" defaultValue={s.contactAddress} className="sm:col-span-2" />
          <Field label="President name (card)" name="presidentName" defaultValue={s.presidentName} />
          <Field label="President signature image" name="signature" type="file" accept="image/*" hint={s.presidentSignatureUrl ? "A signature is set; upload to replace." : "Shown on membership cards."} />
        </section>
        <section className="card grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-bold text-navy sm:col-span-2">Membership</h2>
          <Field label="Membership number prefix" name="membershipPrefix" defaultValue={s.membershipPrefix} hint="Numbers are generated as PREFIX-000001 by the server." />
          <Field label="Fee payment sequence" name="paymentPolicy" defaultValue={s.paymentPolicy} options={[{ value: "after_approval", label: "Pay after preliminary approval" }, { value: "before_approval", label: "Pay before approval (reconciled)" }]} required />
          <Field label="Renewal reminder days before expiry" name="reminderDays" defaultValue={s.reminderDays} hint="Comma separated, e.g. 30,15,7" />
          <Field label="Commission per verified registration (₹, 0 = off)" name="commissionRs" type="number" min={0} defaultValue={s.commissionPerRegistrationPaise / 100} />
        </section>
        <section className="card grid gap-3 sm:grid-cols-2">
          <h2 className="text-sm font-bold text-navy sm:col-span-2">Shop</h2>
          <Field label="Delivery charge (₹)" name="deliveryChargeRs" type="number" min={0} defaultValue={s.deliveryChargePaise / 100} />
          <Field label="Free delivery above (₹, 0 = never)" name="freeDeliveryAboveRs" type="number" min={0} defaultValue={s.freeDeliveryAbovePaise / 100} />
          <Checkbox name="codEnabled" label="Enable cash on delivery" defaultChecked={s.codEnabled} />
          <Checkbox name="pickupEnabled" label="Allow shop pickup" defaultChecked={s.pickupEnabled} />
        </section>
        <section className="card grid gap-3">
          <h2 className="text-sm font-bold text-navy">Legal text</h2>
          <Field label="Terms & Conditions" name="terms" rows={5} defaultValue={s.terms} />
          <Field label="Privacy Policy" name="privacy" rows={5} defaultValue={s.privacy} />
        </section>
        <SubmitButton>Save settings</SubmitButton>
      </form>
      <section className="card mt-4">
        <h2 className="mb-2 text-sm font-bold text-navy">Integrations (server environment)</h2>
        <p className="mb-2 text-xs text-slate-500">Secrets are read from server environment variables only and are never shown or stored here.</p>
        <ul className="space-y-1 text-sm">{integrations.map(([n, ok, v]) => <li key={n} className="flex flex-wrap items-center justify-between gap-2"><span>{n} <code className="text-[11px] text-slate-500">{v}</code></span><StatusBadge status={ok ? "active" : "pending"} text={ok ? "Configured" : "Not configured"} /></li>)}</ul>
      </section>
    </>
  );
}
