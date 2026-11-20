import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/shared/ui";
import { requireMember } from "@/lib/auth/session";
import { latestNews } from "@/lib/data/content";
import { NEWS_CATEGORIES } from "@/constants/status";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "News" };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const { member } = await requireMember();
  const list = await latestNews(member, 50, cat);
  return (
    <>
      <PageHeader title="News & Announcements" crumbs={[{ label: "Home", href: "/home" }, { label: "News" }]} />
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {[["", "All"], ...Object.entries(NEWS_CATEGORIES)].map(([k, v]) => (
          <Link key={k} href={k ? `/news?cat=${k}` : "/news"} className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold", (cat ?? "") === k ? "border-navy bg-navy text-white" : "border-slate-300 bg-white text-navy")}>
            {v}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title="No news yet" hint="Announcements from the association will appear here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((n) => (
            <Link key={n.id} href={`/news/${n.id}`} className="card flex flex-col overflow-hidden !p-0 hover:border-royal">
              {n.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.imageUrl} alt="" className="h-36 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn("badge", n.category === "emergency" || n.category === "important" ? "border-red-200 bg-red-100 text-red-800" : "border-blue-200 bg-blue-100 text-blue-800")}>{NEWS_CATEGORIES[n.category] ?? n.category}</span>
                  {n.isNotice && <span className="badge border-amber-200 bg-amber-100 text-amber-800">Official Notice</span>}
                </div>
                <h2 className="font-bold text-navy">{n.title}</h2>
                <p className="mt-1 line-clamp-3 text-sm text-slate-600">{n.summary ?? n.body}</p>
                <p className="mt-auto pt-2 text-[11px] text-slate-500">{formatDate(n.publishAt)} • R2M CONNECT • <span className="link">Read more</span></p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
