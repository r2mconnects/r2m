import {
  BadgeCheck, Bell, Boxes, CalendarDays, ClipboardCheck, Droplet, FileBarChart, FileText, HandCoins, HeartHandshake,
  History, Home, IdCard, IndianRupee, KeyRound, LayoutDashboard, LifeBuoy, Map, MapPin, Newspaper, Package, Receipt,
  RefreshCw, ScrollText, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Siren, Tags, TicketPercent, TrendingUp, User,
  UserCog, Users, Wrench, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  BadgeCheck, Bell, Boxes, CalendarDays, ClipboardCheck, Droplet, FileBarChart, FileText, HandCoins, HeartHandshake,
  History, Home, IdCard, IndianRupee, KeyRound, LayoutDashboard, LifeBuoy, Map, MapPin, Newspaper, Package, Receipt,
  RefreshCw, ScrollText, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Siren, Tags, TicketPercent, TrendingUp, User,
  UserCog, Users, Wrench,
};

export function Icon({ name, className, size = 20 }: { name: string; className?: string; size?: number }) {
  const C = MAP[name] ?? FileText;
  return <C className={className} size={size} aria-hidden />;
}
