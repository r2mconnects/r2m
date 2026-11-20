export type NavItem = { key: string; href: string; icon: string; module?: string; badge?: "applications" };

/** Mobile bottom navigation (member screens) — also used as the desktop top navigation. */
export const BOTTOM_NAV: NavItem[] = [
  { key: "home", href: "/home", icon: "Home" },
  { key: "news", href: "/news", icon: "Newspaper" },
  { key: "events", href: "/events", icon: "CalendarDays" },
  { key: "shop", href: "/shop", icon: "ShoppingBag" },
  { key: "member", href: "/member", icon: "IdCard" },
];

export const DRAWER_LINKS: NavItem[] = [
  { key: "profile", href: "/member/profile", icon: "User" },
  { key: "membership", href: "/member/membership", icon: "BadgeCheck" },
  { key: "card", href: "/member/membership/card", icon: "IdCard" },
  { key: "renewal", href: "/member/membership/renewal", icon: "RefreshCw" },
  { key: "payments", href: "/member/payments", icon: "Receipt" },
  { key: "welfare", href: "/welfare", icon: "HeartHandshake" },
  { key: "emergency", href: "/emergency", icon: "Siren" },
  { key: "blood", href: "/blood-donors", icon: "Droplet" },
  { key: "mechanics", href: "/mechanics", icon: "Wrench" },
  { key: "orders", href: "/shop/orders", icon: "Package" },
  { key: "documents", href: "/member/documents", icon: "FileText" },
  { key: "notifications", href: "/notifications", icon: "Bell" },
  { key: "support", href: "/member/support", icon: "LifeBuoy" },
  { key: "settings", href: "/member/settings", icon: "Settings" },
  { key: "terms", href: "/terms", icon: "ScrollText" },
  { key: "privacy", href: "/privacy", icon: "ShieldCheck" },
];

export type AdminNav = { label: string; href: string; icon: string; module: string; badge?: "applications" };

export const ADMIN_NAV: AdminNav[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard", module: "*" },
  { label: "Members", href: "/admin/members", icon: "Users", module: "members" },
  { label: "Applications", href: "/admin/applications", icon: "ClipboardCheck", module: "applications", badge: "applications" },
  { label: "Staff", href: "/admin/staff", icon: "UserCog", module: "staff" },
  { label: "Roles & Permissions", href: "/admin/roles", icon: "KeyRound", module: "roles" },
  { label: "Districts", href: "/admin/districts", icon: "Map", module: "geography" },
  { label: "Mandals", href: "/admin/mandals", icon: "MapPin", module: "geography" },
  { label: "Plans & Cards", href: "/admin/memberships", icon: "IdCard", module: "plans" },
  { label: "Payments & Finance", href: "/admin/payments", icon: "IndianRupee", module: "payments" },
  { label: "Collections", href: "/admin/payments?tab=collections", icon: "HandCoins", module: "collections" },
  { label: "Welfare", href: "/admin/welfare", icon: "HeartHandshake", module: "welfare" },
  { label: "Emergency", href: "/admin/emergency", icon: "Siren", module: "emergency" },
  { label: "Blood Donors", href: "/admin/donors", icon: "Droplet", module: "donors" },
  { label: "Workshops", href: "/admin/workshops", icon: "Wrench", module: "workshops" },
  { label: "Products", href: "/admin/shop/products", icon: "Package", module: "shop" },
  { label: "Categories", href: "/admin/shop/categories", icon: "Tags", module: "shop" },
  { label: "Inventory", href: "/admin/shop/inventory", icon: "Boxes", module: "shop" },
  { label: "Orders", href: "/admin/shop/orders", icon: "ShoppingCart", module: "orders" },
  { label: "Coupons", href: "/admin/shop/coupons", icon: "TicketPercent", module: "shop" },
  { label: "Sales Reports", href: "/admin/shop/sales", icon: "TrendingUp", module: "shop" },
  { label: "News & Notices", href: "/admin/news", icon: "Newspaper", module: "news" },
  { label: "Events & Meetings", href: "/admin/events", icon: "CalendarDays", module: "events" },
  { label: "Notifications", href: "/admin/notifications", icon: "Bell", module: "notifications" },
  { label: "Reports & Exports", href: "/admin/reports", icon: "FileBarChart", module: "reports" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "History", module: "audit" },
  { label: "Settings", href: "/admin/settings", icon: "Settings", module: "settings" },
];
