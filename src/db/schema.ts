import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";

const pk = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type Permissions = Record<string, string[]>;

/* ───────── sequences (server-generated numbers) ───────── */
export const membershipSeq = pgSequence("membership_seq", { startWith: 1 });
export const orderSeq = pgSequence("order_seq", { startWith: 1001 });
export const receiptSeq = pgSequence("receipt_seq", { startWith: 1 });
export const applicationSeq = pgSequence("application_seq", { startWith: 1 });

/* ───────── authentication & roles ───────── */
export const users = pgTable(
  "users",
  {
    id: pk(),
    email: text("email"),
    mobile: text("mobile"),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    photoUrl: text("photo_url"),
    status: text("status").notNull().default("active"), // active | suspended | invited
    language: text("language").notNull().default("en"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_mobile_uq").on(t.mobile)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of cookie token
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  id: pk(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").notNull().default("reset"), // reset | activation
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: created(),
});

export const roles = pgTable("roles", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  scope: text("scope").notNull().default("global"), // global | district | mandal | agent | self
  level: integer("level").notNull().default(50),
  permissions: jsonb("permissions").$type<Permissions>().notNull().default({}),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: created(),
});

export const districts = pgTable("districts", {
  id: pk(),
  name: text("name").notNull().unique(),
  code: text("code"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const mandals = pgTable(
  "mandals",
  {
    id: pk(),
    districtId: uuid("district_id").notNull().references(() => districts.id),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("mandals_district_name_uq").on(t.districtId, t.name)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: pk(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleKey: text("role_key").notNull().references(() => roles.key),
    districtId: uuid("district_id").references(() => districts.id),
    mandalId: uuid("mandal_id").references(() => mandals.id),
    employeeId: text("employee_id"),
    reportingOfficerId: uuid("reporting_officer_id").references(() => users.id),
    joiningDate: date("joining_date"),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: created(),
  },
  (t) => [uniqueIndex("user_roles_uq").on(t.userId, t.roleKey), index("user_roles_user_idx").on(t.userId)],
);

/* ───────── members ───────── */
export const members = pgTable(
  "members",
  {
    id: pk(),
    userId: uuid("user_id").references(() => users.id),
    applicationRef: text("application_ref").notNull(),
    membershipNo: text("membership_no"),
    fullName: text("full_name").notNull(),
    mobile: text("mobile").notNull(),
    email: text("email"),
    dob: date("dob"),
    photoUrl: text("photo_url"),
    address: text("address"),
    village: text("village"),
    districtId: uuid("district_id").references(() => districts.id),
    mandalId: uuid("mandal_id").references(() => mandals.id),
    workshopName: text("workshop_name"),
    workshopAddress: text("workshop_address"),
    experienceYears: integer("experience_years"),
    specialization: text("specialization"),
    services: text("services"),
    workingHours: text("working_hours"),
    emergencyName: text("emergency_name"),
    emergencyPhone: text("emergency_phone"),
    nomineeName: text("nominee_name"),
    nomineeRelation: text("nominee_relation"),
    status: text("status").notNull().default("pending"), // pending | under_review | active | expired | suspended | rejected
    rejectReason: text("reject_reason"),
    agentId: uuid("agent_id").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    validFrom: date("valid_from"),
    validTill: date("valid_till"),
    directoryOptIn: boolean("directory_opt_in").notNull().default(false),
    directoryVerified: boolean("directory_verified").notNull().default(false),
    planId: uuid("plan_id"),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("members_no_uq").on(t.membershipNo),
    uniqueIndex("members_ref_uq").on(t.applicationRef),
    uniqueIndex("members_mobile_uq").on(t.mobile),
    index("members_district_idx").on(t.districtId),
    index("members_mandal_idx").on(t.mandalId),
    index("members_status_idx").on(t.status),
    index("members_agent_idx").on(t.agentId),
  ],
);

export const membershipPlans = pgTable("membership_plans", {
  id: pk(),
  name: text("name").notNull(),
  joiningFeePaise: integer("joining_fee_paise").notNull().default(0),
  applicationFeePaise: integer("application_fee_paise").notNull().default(0),
  renewalFeePaise: integer("renewal_fee_paise").notNull().default(0),
  lateFeePaise: integer("late_fee_paise").notNull().default(0),
  graceDays: integer("grace_days").notNull().default(30),
  validityMonths: integer("validity_months").notNull().default(12),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

export const membershipRenewals = pgTable("membership_renewals", {
  id: pk(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  planId: uuid("plan_id").references(() => membershipPlans.id),
  transactionId: uuid("transaction_id"),
  kind: text("kind").notNull().default("renewal"), // joining | renewal
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  amountPaise: integer("amount_paise").notNull().default(0),
  createdAt: created(),
});

export const membershipCards = pgTable(
  "membership_cards",
  {
    id: pk(),
    memberId: uuid("member_id").notNull().references(() => members.id),
    token: text("token").notNull(),
    status: text("status").notNull().default("active"), // active | suspended | cancelled
    version: integer("version").notNull().default(1),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cards_token_uq").on(t.token), uniqueIndex("cards_member_uq").on(t.memberId)],
);

export const membershipCardHistory = pgTable("membership_card_history", {
  id: pk(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  action: text("action").notNull(),
  note: text("note"),
  userId: uuid("user_id"),
  createdAt: created(),
});

export const memberDocuments = pgTable("member_documents", {
  id: pk(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  docType: text("doc_type").notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name"),
  createdAt: created(),
});

/* ───────── finance ───────── */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: pk(),
    kind: text("kind").notNull(), // membership_fee | renewal | shop_order
    memberId: uuid("member_id").references(() => members.id),
    userId: uuid("user_id").references(() => users.id),
    orderId: uuid("order_id"),
    amountPaise: integer("amount_paise").notNull(),
    method: text("method").notNull(), // razorpay | cash | upi | bank | cod
    status: text("status").notNull().default("created"), // created | paid | failed | refunded
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    receiptNo: text("receipt_no"),
    purpose: text("purpose"),
    planId: uuid("plan_id"),
    collectedBy: uuid("collected_by"),
    verifiedBy: uuid("verified_by"),
    createdAt: created(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("pay_member_idx").on(t.memberId),
    index("pay_status_idx").on(t.status),
    uniqueIndex("pay_gateway_payment_uq").on(t.gatewayPaymentId),
    uniqueIndex("pay_receipt_uq").on(t.receiptNo),
  ],
);

export const manualCollections = pgTable("manual_collections", {
  id: pk(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  amountPaise: integer("amount_paise").notNull(),
  method: text("method").notNull(), // cash | upi | bank
  reference: text("reference"),
  purpose: text("purpose").notNull(), // application_fee | renewal
  status: text("status").notNull().default("pending"), // pending | verified | rejected
  collectedBy: uuid("collected_by").notNull(),
  verifiedBy: uuid("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  transactionId: uuid("transaction_id"),
  notes: text("notes"),
  createdAt: created(),
});

export const refunds = pgTable("refunds", {
  id: pk(),
  transactionId: uuid("transaction_id"),
  orderId: uuid("order_id"),
  amountPaise: integer("amount_paise").notNull(),
  reason: text("reason"),
  method: text("method").notNull().default("manual"),
  reference: text("reference"),
  gatewayRefundId: text("gateway_refund_id"),
  processedBy: uuid("processed_by"),
  createdAt: created(),
});

export const expenses = pgTable("expenses", {
  id: pk(),
  category: text("category").notNull(),
  description: text("description"),
  amountPaise: integer("amount_paise").notNull(),
  spentOn: date("spent_on").notNull(),
  createdBy: uuid("created_by"),
  createdAt: created(),
});

/* ───────── news & events ───────── */
export const news = pgTable(
  "news",
  {
    id: pk(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    category: text("category").notNull().default("general"),
    imageUrl: text("image_url"),
    attachmentUrl: text("attachment_url"),
    status: text("status").notNull().default("published"), // draft | published | unpublished
    publishAt: timestamp("publish_at", { withTimezone: true }).notNull().defaultNow(),
    districtId: uuid("district_id").references(() => districts.id),
    mandalId: uuid("mandal_id").references(() => mandals.id),
    authorId: uuid("author_id").references(() => users.id),
    isNotice: boolean("is_notice").notNull().default(false),
    createdAt: created(),
  },
  (t) => [index("news_publish_idx").on(t.publishAt)],
);

export const events = pgTable(
  "events",
  {
    id: pk(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("meeting"), // meeting | training | camp | other
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    venue: text("venue"),
    districtId: uuid("district_id").references(() => districts.id),
    mandalId: uuid("mandal_id").references(() => mandals.id),
    organizer: text("organizer"),
    contact: text("contact"),
    imageUrl: text("image_url"),
    status: text("status").notNull().default("published"), // published | cancelled
    registrationOpen: boolean("registration_open").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: created(),
  },
  (t) => [index("events_start_idx").on(t.startsAt)],
);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: pk(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id),
    attended: boolean("attended").notNull().default(false),
    createdAt: created(),
  },
  (t) => [uniqueIndex("event_reg_uq").on(t.eventId, t.memberId)],
);

/* ───────── shop ───────── */
export const productCategories = pgTable("product_categories", {
  id: pk(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const productBrands = pgTable("product_brands", {
  id: pk(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable(
  "products",
  {
    id: pk(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id),
    brandId: uuid("brand_id").references(() => productBrands.id),
    manufacturer: text("manufacturer"),
    description: text("description"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    mrpPaise: integer("mrp_paise").notNull(),
    pricePaise: integer("price_paise").notNull(),
    gstRate: integer("gst_rate").notNull().default(18),
    hsn: text("hsn"),
    stock: integer("stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(5),
    unit: text("unit").notNull().default("pcs"),
    specs: text("specs"),
    warranty: text("warranty"),
    weightGrams: integer("weight_grams"),
    status: text("status").notNull().default("active"), // active | draft | archived
    featured: boolean("featured").notNull().default(false),
    soldCount: integer("sold_count").notNull().default(0),
    createdAt: created(),
  },
  (t) => [index("products_cat_idx").on(t.categoryId), index("products_status_idx").on(t.status)],
);

export const stockMovements = pgTable("stock_movements", {
  id: pk(),
  productId: uuid("product_id").notNull().references(() => products.id),
  type: text("type").notNull(), // opening | purchase | sale | return | adjustment | cancel
  qty: integer("qty").notNull(), // signed
  reason: text("reason").notNull(),
  source: text("source"),
  refId: text("ref_id"),
  userId: uuid("user_id"),
  createdAt: created(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: pk(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(1),
    createdAt: created(),
  },
  (t) => [uniqueIndex("cart_uq").on(t.userId, t.productId)],
);

export const coupons = pgTable("coupons", {
  id: pk(),
  code: text("code").notNull().unique(),
  kind: text("kind").notNull().default("percent"), // percent | flat
  value: integer("value").notNull(), // percent or paise
  minOrderPaise: integer("min_order_paise").notNull().default(0),
  maxDiscountPaise: integer("max_discount_paise"),
  usageLimit: integer("usage_limit"),
  used: integer("used").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

export type OrderAddress = {
  name: string;
  mobile: string;
  address: string;
  district?: string;
  mandal?: string;
  village?: string;
  pin?: string;
  instructions?: string;
};

export const orders = pgTable(
  "orders",
  {
    id: pk(),
    orderNo: text("order_no").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    memberId: uuid("member_id").references(() => members.id),
    status: text("status").notNull().default("payment_pending"),
    paymentMethod: text("payment_method").notNull().default("online"), // online | cod | manual
    paymentStatus: text("payment_status").notNull().default("pending"), // pending | paid | refunded
    fulfilment: text("fulfilment").notNull().default("delivery"), // delivery | pickup
    subtotalPaise: integer("subtotal_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    deliveryPaise: integer("delivery_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    gstPaise: integer("gst_paise").notNull().default(0),
    couponCode: text("coupon_code"),
    address: jsonb("address").$type<OrderAddress>().notNull(),
    stockDeducted: boolean("stock_deducted").notNull().default(false),
    invoiceNo: text("invoice_no"),
    checkoutKey: text("checkout_key").unique(), // idempotency: prevents duplicate orders
    cancelReason: text("cancel_reason"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable("order_items", {
  id: pk(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  qty: integer("qty").notNull(),
  unitPaise: integer("unit_paise").notNull(),
  gstRate: integer("gst_rate").notNull().default(0),
  hsn: text("hsn"),
});

export const productReturns = pgTable("product_returns", {
  id: pk(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"), // requested | approved | rejected | received
  createdAt: created(),
});

/* ───────── welfare & emergency ───────── */
export const welfareSchemes = pgTable("welfare_schemes", {
  id: pk(),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  description: text("description"),
  maxAmountPaise: integer("max_amount_paise"),
  approvalLevels: jsonb("approval_levels").$type<string[]>().notNull().default([]), // mandal | district | welfare_officer
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

export type WelfareDoc = { name: string; file: string };

export const welfareApplications = pgTable(
  "welfare_applications",
  {
    id: pk(),
    refNo: text("ref_no").notNull().unique(),
    schemeId: uuid("scheme_id").notNull().references(() => welfareSchemes.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    reason: text("reason").notNull(),
    description: text("description"),
    requestedPaise: integer("requested_paise"),
    approvedPaise: integer("approved_paise"),
    emergencyContact: text("emergency_contact"),
    consent: boolean("consent").notNull().default(false),
    status: text("status").notNull().default("submitted"),
    currentStage: text("current_stage").notNull().default("review"),
    documents: jsonb("documents").$type<WelfareDoc[]>().notNull().default([]),
    decisionReason: text("decision_reason"),
    approvedBy: uuid("approved_by"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("welfare_member_idx").on(t.memberId), index("welfare_status_idx").on(t.status)],
);

export const welfareApprovals = pgTable("welfare_approvals", {
  id: pk(),
  applicationId: uuid("application_id").notNull().references(() => welfareApplications.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  decision: text("decision").notNull(),
  comment: text("comment"),
  userId: uuid("user_id"),
  createdAt: created(),
});

export const welfareDisbursements = pgTable("welfare_disbursements", {
  id: pk(),
  applicationId: uuid("application_id").notNull().references(() => welfareApplications.id),
  amountPaise: integer("amount_paise").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  disbursedBy: uuid("disbursed_by").notNull(),
  createdAt: created(),
});

export const emergencyContacts = pgTable("emergency_contacts", {
  id: pk(),
  label: text("label").notNull(),
  phone: text("phone").notNull(),
  kind: text("kind").notNull().default("association"), // association | ambulance | hospital
  districtId: uuid("district_id").references(() => districts.id),
  active: boolean("active").notNull().default(true),
});

export const emergencyRequests = pgTable("emergency_requests", {
  id: pk(),
  memberId: uuid("member_id").notNull().references(() => members.id),
  message: text("message").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  status: text("status").notNull().default("submitted"), // submitted | acknowledged | responding | resolved | closed
  assignedTo: uuid("assigned_to").references(() => users.id),
  responseNote: text("response_note"),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────── additional ───────── */
export const bloodDonors = pgTable(
  "blood_donors",
  {
    id: pk(),
    memberId: uuid("member_id").notNull().references(() => members.id),
    bloodGroup: text("blood_group").notNull(),
    districtId: uuid("district_id").references(() => districts.id),
    mandalId: uuid("mandal_id").references(() => mandals.id),
    location: text("location"),
    available: boolean("available").notNull().default(true),
    consent: boolean("consent").notNull().default(false),
    createdAt: created(),
  },
  (t) => [uniqueIndex("donor_member_uq").on(t.memberId)],
);

export const bloodRequests = pgTable("blood_requests", {
  id: pk(),
  requesterId: uuid("requester_id").notNull().references(() => users.id),
  bloodGroup: text("blood_group").notNull(),
  units: integer("units").notNull().default(1),
  hospital: text("hospital").notNull(),
  districtId: uuid("district_id").references(() => districts.id),
  mandalId: uuid("mandal_id").references(() => mandals.id),
  contactPhone: text("contact_phone").notNull(),
  note: text("note"),
  status: text("status").notNull().default("open"),
  createdAt: created(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    kind: text("kind").notNull().default("general"),
    channelStatus: jsonb("channel_status").$type<Record<string, string>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("notif_user_idx").on(t.userId)],
);

export const supportTickets = pgTable("support_tickets", {
  id: pk(),
  userId: uuid("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // open | answered | closed
  reply: text("reply"),
  repliedBy: uuid("replied_by"),
  createdAt: created(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: created(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const associationSettings = pgTable("association_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: pk(),
    identifier: text("identifier").notNull(),
    success: boolean("success").notNull().default(false),
    createdAt: created(),
  },
  (t) => [index("login_attempts_idx").on(t.identifier, t.createdAt)],
);
