import { cookies } from "next/headers";

export type Lang = "en" | "te";

const dict: Record<string, { en: string; te: string }> = {
  home: { en: "Home", te: "హోమ్" },
  news: { en: "News", te: "వార్తలు" },
  events: { en: "Events", te: "కార్యక్రమాలు" },
  shop: { en: "Shop", te: "షాప్" },
  member: { en: "Member", te: "సభ్యుడు" },
  profile: { en: "My Profile", te: "నా ప్రొఫైల్" },
  membership: { en: "Membership Details", te: "సభ్యత్వ వివరాలు" },
  card: { en: "Digital ID Card", te: "డిజిటల్ ఐడి కార్డ్" },
  renewal: { en: "Membership Renewal", te: "సభ్యత్వ పునరుద్ధరణ" },
  payments: { en: "Payment History", te: "చెల్లింపుల చరిత్ర" },
  welfare: { en: "Welfare Services", te: "సంక్షేమ సేవలు" },
  emergency: { en: "Emergency Assistance", te: "అత్యవసర సహాయం" },
  blood: { en: "Blood Donors", te: "రక్తదాతలు" },
  mechanics: { en: "Find Mechanics", te: "మెకానిక్‌లను కనుగొనండి" },
  orders: { en: "My Orders", te: "నా ఆర్డర్లు" },
  documents: { en: "My Documents", te: "నా పత్రాలు" },
  notifications: { en: "Notifications", te: "నోటిఫికేషన్లు" },
  support: { en: "Help & Support", te: "సహాయం & మద్దతు" },
  settings: { en: "Settings & Language", te: "సెట్టింగ్‌లు & భాష" },
  terms: { en: "Terms & Conditions", te: "నిబంధనలు & షరతులు" },
  privacy: { en: "Privacy Policy", te: "గోప్యతా విధానం" },
  logout: { en: "Logout", te: "లాగ్అవుట్" },
  welcome: { en: "Welcome", te: "స్వాగతం" },
  membershipNo: { en: "Membership No", te: "సభ్యత్వ సంఖ్య" },
  validTill: { en: "Valid Till", te: "చెల్లుబాటు తేదీ" },
  quickActions: { en: "Quick Actions", te: "త్వరిత చర్యలు" },
  viewCard: { en: "View ID Card", te: "ఐడి కార్డ్ చూడండి" },
  renew: { en: "Renew Membership", te: "సభ్యత్వ పునరుద్ధరణ" },
  payFees: { en: "Pay Fees", te: "ఫీజు చెల్లించండి" },
  applyWelfare: { en: "Apply for Welfare", te: "సంక్షేమానికి దరఖాస్తు" },
  visitShop: { en: "Visit Shop", te: "షాప్ చూడండి" },
  viewNotices: { en: "View Notices", te: "నోటీసులు చూడండి" },
  latestNews: { en: "Latest News", te: "తాజా వార్తలు" },
  upcomingEvents: { en: "Upcoming Events", te: "రాబోయే కార్యక్రమాలు" },
  adminPanel: { en: "Admin Panel", te: "అడ్మిన్ ప్యానెల్" },
  more: { en: "More", te: "మరిన్ని" },
  status: { en: "Status", te: "స్థితి" },
};

export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return jar.get("r2m_lang")?.value === "te" ? "te" : "en";
}

export function t(lang: Lang, key: string) {
  return dict[key]?.[lang] ?? dict[key]?.en ?? key;
}
