import { CardActions } from "@/components/membership/CardActions";
import { MembershipCard } from "@/components/membership/MembershipCard";
import { EmptyState, PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { buildCard } from "@/lib/data/members";

export const metadata = { title: "Digital ID Card" };

export default async function CardPage() {
  const { member: m } = await requireMember();
  const data = m.membershipNo ? await buildCard(m.id) : null;
  return (
    <div className="mx-auto max-w-xl">
      <div className="no-print">
        <PageHeader title="Membership Card" crumbs={[{ label: "Home", href: "/home" }, { label: "Member", href: "/member" }, { label: "Membership Card" }]} />
      </div>
      {!data ? (
        <EmptyState title="Your card is not issued yet" hint="The digital ID card is generated after your membership is approved and the fee is verified." />
      ) : (
        <>
          <MembershipCard c={data.card} />
          <CardActions link={data.link} fileName={`R2M-card-${m.membershipNo}`} />
        </>
      )}
    </div>
  );
}
