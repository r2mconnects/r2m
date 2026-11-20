import Link from "next/link";
import { ImageOff, ShoppingCart } from "lucide-react";
import { addToCartAction } from "@/actions/shop.actions";
import { formatINR } from "@/lib/utils";

export type ProductCardData = {
  id: string; name: string; brand: string | null; pricePaise: number; mrpPaise: number; stock: number; minStock: number; images: string[];
};

export function ProductCard({ p, back = "/shop" }: { p: ProductCardData; back?: string }) {
  const off = p.mrpPaise > p.pricePaise ? Math.round(((p.mrpPaise - p.pricePaise) / p.mrpPaise) * 100) : 0;
  const out = p.stock <= 0;
  return (
    <div className="card flex flex-col overflow-hidden !p-0">
      <Link href={`/shop/products/${p.id}`} className="relative block aspect-square bg-slate-100">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full items-center justify-center text-slate-300"><ImageOff size={36} /></span>
        )}
        {off > 0 && <span className="absolute left-2 top-2 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{off}% OFF</span>}
      </Link>
      <div className="flex flex-1 flex-col p-2.5">
        {p.brand && <p className="text-[10px] font-semibold uppercase text-slate-500">{p.brand}</p>}
        <Link href={`/shop/products/${p.id}`} className="line-clamp-2 text-sm font-semibold text-navy">{p.name}</Link>
        <p className="mt-1 text-base font-bold">{formatINR(p.pricePaise)} {off > 0 && <span className="text-xs font-normal text-slate-400 line-through">{formatINR(p.mrpPaise)}</span>}</p>
        <p className={`text-[11px] font-semibold ${out ? "text-red-600" : p.stock <= p.minStock ? "text-amber-600" : "text-green-600"}`}>
          {out ? "Out of stock" : p.stock <= p.minStock ? `Only ${p.stock} left` : "In stock"}
        </p>
        <form action={addToCartAction} className="mt-auto pt-2">
          <input type="hidden" name="productId" value={p.id} />
          <input type="hidden" name="back" value={back} />
          <button disabled={out} className="btn btn-primary btn-sm w-full"><ShoppingCart size={14} /> {out ? "Unavailable" : "Add to Cart"}</button>
        </form>
      </div>
    </div>
  );
}
