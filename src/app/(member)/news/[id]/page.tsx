import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { db } from "@/db";
import { news, users } from "@/db/schema";
import { PageHeader } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { visibleNews } from "@/lib/data/content";
import { NEWS_CATEGORIES } from "@/constants/status";
import { formatDate } from "@/lib/utils";

export default async function NewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { member } = await requireMember();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [n] = await db
    .select({ n: news, author: users.fullName })
    .from(news)
    .leftJoin(users, eq(users.id, news.authorId))
    .where(and(eq(news.id, id), visibleNews(member)));
  if (!n) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader title={n.n.title} crumbs={[{ label: "News", href: "/news" }, { label: NEWS_CATEGORIES[n.n.category] ?? "News" }]} subtitle={`${formatDate(n.n.publishAt)} • Published by ${n.author ?? "R2M CONNECT"}`} />
      <div className="card">
        {n.n.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={n.n.imageUrl} alt="" className="mb-3 max-h-80 w-full rounded-lg object-cover" />
        )}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{n.n.body}</div>
        {n.n.attachmentUrl && (
          <a href={n.n.attachmentUrl} target="_blank" className="btn btn-outline btn-sm mt-4"><Paperclip size={14} /> Attachment</a>
        )}
      </div>
    </article>
  );
}
