import type { Permissions } from "@/db/schema";

export const ACTIONS = ["view", "create", "edit", "approve", "reject", "delete", "export", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

export const MODULES = [
  { key: "members", label: "Members" },
  { key: "applications", label: "Applications" },
  { key: "staff", label: "Staff" },
  { key: "roles", label: "Roles" },
  { key: "geography", label: "Districts & Mandals" },
  { key: "plans", label: "Membership Plans" },
  { key: "cards", label: "Membership Cards" },
  { key: "payments", label: "Payments" },
  { key: "collections", label: "Manual Collections" },
  { key: "news", label: "News" },
  { key: "events", label: "Events" },
  { key: "shop", label: "Shop & Products" },
  { key: "orders", label: "Orders" },
  { key: "welfare", label: "Welfare" },
  { key: "disbursements", label: "Welfare Disbursements" },
  { key: "emergency", label: "Emergency" },
  { key: "donors", label: "Blood Donors" },
  { key: "workshops", label: "Workshops" },
  { key: "reports", label: "Reports" },
  { key: "notifications", label: "Notifications" },
  { key: "support", label: "Support" },
  { key: "settings", label: "Settings" },
  { key: "audit", label: "Audit Logs" },
] as const;
export type ModuleKey = (typeof MODULES)[number]["key"];

const V = ["view"];
const VC = ["view", "create"];
const VCE = ["view", "create", "edit"];
const VAR = ["view", "approve", "reject"];
const ALL = [...ACTIONS] as string[];

export type RoleDef = {
  key: string;
  name: string;
  description: string;
  scope: "global" | "district" | "mandal" | "agent" | "self";
  level: number;
  permissions: Permissions;
};

export const ROLE_DEFS: RoleDef[] = [
  {
    key: "main_admin",
    name: "Main Admin",
    description: "Highest authority. Full control of the entire association.",
    scope: "global",
    level: 0,
    permissions: Object.fromEntries(MODULES.map((m) => [m.key, ALL])),
  },
  {
    key: "zone_president",
    name: "Zone President",
    description: "Zone-level leadership across all districts.",
    scope: "global",
    level: 10,
    permissions: {
      members: ["view", "approve", "reject", "export"],
      applications: VAR,
      staff: V,
      geography: V,
      payments: ["view", "export"],
      news: VCE,
      events: VCE,
      welfare: ["view", "approve", "reject"],
      emergency: V,
      donors: V,
      workshops: V,
      reports: ["view", "export"],
      orders: V,
    },
  },
  {
    key: "zone_secretary",
    name: "Zone Secretary",
    description: "Zone administration.",
    scope: "global",
    level: 11,
    permissions: { members: V, applications: V, staff: V, geography: V, news: VCE, events: VCE, welfare: V, reports: V, workshops: V },
  },
  {
    key: "district_president",
    name: "District President",
    description: "Assigned district only.",
    scope: "district",
    level: 20,
    permissions: {
      members: ["view", "edit", "export"],
      applications: VAR,
      staff: VCE,
      geography: V,
      news: VC,
      events: VCE,
      welfare: ["view", "edit"],
      emergency: ["view", "edit"],
      donors: V,
      workshops: V,
      reports: ["view", "export"],
    },
  },
  {
    key: "district_secretary",
    name: "District Secretary",
    description: "Assigned district administration.",
    scope: "district",
    level: 21,
    permissions: { members: V, applications: V, geography: V, news: VC, events: VC, welfare: ["view", "edit"], reports: V, workshops: V },
  },
  {
    key: "mandal_president",
    name: "Mandal President",
    description: "Assigned mandal only.",
    scope: "mandal",
    level: 30,
    permissions: { members: VC, applications: ["view", "create", "approve", "reject"], events: VCE, news: V, welfare: ["view", "edit"], reports: V, workshops: V },
  },
  {
    key: "mandal_secretary",
    name: "Mandal Secretary",
    description: "Assigned mandal administration.",
    scope: "mandal",
    level: 31,
    permissions: { members: VC, applications: VC, events: VC, news: V, reports: V },
  },
  {
    key: "agent",
    name: "Agent",
    description: "Registers members and records collections in assigned area.",
    scope: "agent",
    level: 40,
    permissions: { members: VCE, applications: VC, collections: VC, reports: V },
  },
  {
    key: "employee",
    name: "Employee",
    description: "Office employee with assigned functions.",
    scope: "global",
    level: 41,
    permissions: { members: V, news: VCE, events: VCE, support: ["view", "edit"] },
  },
  {
    key: "finance_officer",
    name: "Finance Officer",
    description: "Verifies collections, receipts and reconciliation.",
    scope: "global",
    level: 42,
    permissions: {
      members: V,
      payments: ["view", "export", "manage"],
      collections: ["view", "approve", "reject"],
      disbursements: ["view", "manage"],
      reports: ["view", "export"],
      orders: V,
    },
  },
  {
    key: "welfare_officer",
    name: "Welfare Officer",
    description: "Reviews welfare applications and emergencies.",
    scope: "global",
    level: 43,
    permissions: { members: V, welfare: ["view", "edit"], emergency: ["view", "edit"], donors: V, reports: V },
  },
  {
    key: "member",
    name: "Member",
    description: "Association member.",
    scope: "self",
    level: 99,
    permissions: {},
  },
];

export const ROLE_NAME: Record<string, string> = Object.fromEntries(ROLE_DEFS.map((r) => [r.key, r.name]));
