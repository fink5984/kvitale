/**
 * Kvittel Global — domain schema (PostgreSQL via Drizzle).
 *
 * Conventions
 *  - All timestamps are UTC (`timestamptz`); every grave carries an IANA timezone.
 *  - Money is integer minor units + ISO currency. Prices are snapshotted on order items.
 *  - Kvittel content (names, requests) is encrypted at the application layer and
 *    NEVER duplicated into plaintext columns, logs or analytics.
 *  - `is_demo` marks seed/simulated data so it is never presented as live fact.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ───────────────────────────── enums ───────────────────────────── */

export const roleEnum = pgEnum("role", [
  "super_admin",
  "admin",
  "finance",
  "support_limited",
  "content_editor",
  "partner_manager",
  "local_maintainer",
  "customer",
]);

export const graveStatusEnum = pgEnum("grave_status", ["discovery_only", "coming_soon", "active", "paused", "maintenance"]);
export const permitStatusEnum = pgEnum("permit_status", ["none", "requested", "approved", "revoked"]);

export const deviceStatusEnum = pgEnum("device_status", ["provisioning", "active", "maintenance", "retired", "revoked"]);
export const commandStatusEnum = pgEnum("command_status", ["pending", "delivered", "succeeded", "failed", "expired", "canceled"]);
export const commandTypeEnum = pgEnum("command_type", [
  "test_print",
  "pause",
  "resume",
  "reboot_agent",
  "restart_service",
  "clear_error",
  "diagnostics",
  "config_update",
  "ota_update",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "in_fulfillment",
  "fulfilled",
  "attention",
  "refunded",
  "partially_refunded",
  "canceled",
  "payment_failed",
]);

export const itemStatusEnum = pgEnum("item_status", [
  "pending_payment",
  "queued",
  "scheduled",
  "sending",
  "printing",
  "printed",
  "cut",
  "chute_confirmed",
  "delivered",
  "uncertain",
  "failed",
  "refunded",
  "canceled",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "scheduled",
  "leased",
  "printing",
  "printed",
  "cut",
  "chute_confirmed",
  "delivered",
  "uncertain",
  "failed",
  "canceled",
]);

export const paymentStatusEnum = pgEnum("payment_status", ["created", "requires_action", "succeeded", "failed", "canceled", "refunded", "partially_refunded"]);
export const refundStatusEnum = pgEnum("refund_status", ["requested", "approved", "succeeded", "failed", "rejected"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "acknowledged", "resolved"]);
export const severityEnum = pgEnum("severity", ["info", "warning", "critical"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "waiting_parts", "resolved", "closed"]);

/* ───────────────────────────── identity ───────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    locale: text("locale").notNull().default("he"),
    currency: text("currency").notNull().default("USD"),
    emailVerifiedAt: ts("email_verified_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at"),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: id(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    redirectTo: text("redirect_to"),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    attempts: smallint("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("magic_links_token_uq").on(t.tokenHash), index("magic_links_email_idx").on(t.email)],
);

export const partners = pgTable("partners", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("operator"), // operator | technician | institution
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  locale: text("locale").notNull().default("he"),
  status: text("status").notNull().default("active"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    /** Scope for partner_manager / local_maintainer roles */
    partnerId: uuid("partner_id").references(() => partners.id),
    grantedBy: uuid("granted_by"),
    createdAt: createdAt(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("role_assignments_user_idx").on(t.userId)],
);

export const userConsents = pgTable(
  "user_consents",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email"),
    kind: text("kind").notNull(), // marketing_email | whatsapp | save_names_cloud | video_proof | terms
    granted: boolean("granted").notNull(),
    source: text("source").notNull(),
    locale: text("locale"),
    createdAt: createdAt(),
  },
  (t) => [index("user_consents_user_idx").on(t.userId), index("user_consents_email_idx").on(t.email)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: uuid("actor_user_id"),
    actorKind: text("actor_kind").notNull(), // user | device | system | webhook
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    /** Never contains kvittel content — only identifiers and non-sensitive deltas */
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_target_idx").on(t.targetType, t.targetId)],
);

/* ───────────────────────────── graves ───────────────────────────── */

export const locations = pgTable("locations", {
  id: id(),
  countryCode: text("country_code").notNull(),
  /** Stable key for city, localized via grave_translations.place_name */
  cityKey: text("city_key").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  /** Only true when an admin verified the coordinates against a trusted source */
  verified: boolean("verified").notNull().default(false),
  verificationSource: text("verification_source"),
});

export const graves = pgTable(
  "graves",
  {
    id: id(),
    slug: text("slug").notNull(),
    status: graveStatusEnum("status").notNull().default("discovery_only"),
    locationId: uuid("location_id").references(() => locations.id),
    timezone: text("timezone").notNull(),
    dynasty: text("dynasty"), // e.g. "chassidut-polin", key for filters
    eraStartYear: smallint("era_start_year"),
    eraEndYear: smallint("era_end_year"),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(100),
    permitStatus: permitStatusEnum("permit_status").notNull().default("none"),
    permitNotes: text("permit_notes"),
    operatorPartnerId: uuid("operator_partner_id").references(() => partners.id),
    observeShabbat: boolean("observe_shabbat").notNull().default(true),
    observeYomTov: boolean("observe_yom_tov").notNull().default(true),
    israelHolidays: boolean("israel_holidays").notNull().default(false),
    /** Conservative pre-Shabbat cut-off in local minutes from midnight Friday (used until verified coordinates allow zmanim) */
    shabbatCutoffMinute: smallint("shabbat_cutoff_minute").notNull().default(720),
    demandCount: integer("demand_count").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("graves_slug_uq").on(t.slug), index("graves_status_idx").on(t.status)],
);

export const graveTranslations = pgTable(
  "grave_translations",
  {
    id: id(),
    graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    /** Short honorific/epithet line, e.g. "Author of Noam Elimelech" */
    epithet: text("epithet"),
    placeName: text("place_name"),
    address: text("address"),
    bio: text("bio"),
    bioSources: text("bio_sources"),
    customs: text("customs"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    faq: jsonb("faq").$type<Array<{ q: string; a: string }>>(),
    reviewed: boolean("reviewed").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("grave_translations_uq").on(t.graveId, t.locale)],
);

export const graveAliases = pgTable(
  "grave_aliases",
  {
    id: id(),
    graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    script: text("script").notNull(), // hebrew | latin | cyrillic
    normalized: text("normalized").notNull(),
  },
  (t) => [index("grave_aliases_norm_idx").on(t.normalized), index("grave_aliases_grave_idx").on(t.graveId)],
);

export const graveMedia = pgTable("grave_media", {
  id: id(),
  graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  alt: jsonb("alt").$type<Record<string, string>>(),
  credit: text("credit"),
  license: text("license"),
  /** Must be true before public display — no unlicensed or misattributed photos */
  rightsVerified: boolean("rights_verified").notNull().default(false),
  /** hero = main image · writing = background of the writing screen · mobile = portrait crop for phones · gallery */
  role: text("role").notNull().default("gallery"),
  /** Focal point (percent, 0-100) used as object-position when the image is cropped */
  focalX: smallint("focal_x").notNull().default(50),
  focalY: smallint("focal_y").notNull().default(50),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const graveSchedules = pgTable("grave_schedules", {
  id: id(),
  graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
  /** 0 = Sunday … 6 = Saturday in the grave's timezone */
  weekday: smallint("weekday").notNull(),
  openMinute: smallint("open_minute").notNull(),
  closeMinute: smallint("close_minute").notNull(),
});

export const graveHilulot = pgTable("grave_hilulot", {
  id: id(),
  graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
  /** Hebrew calendar day & month (hebcal month numbering: 1 = Nisan … 12 = Adar, 13 = Adar II) */
  hebrewDay: smallint("hebrew_day").notNull(),
  hebrewMonth: smallint("hebrew_month").notNull(),
  hebrewYearOfPassing: integer("hebrew_year_of_passing"),
  sourceNote: text("source_note"),
  verified: boolean("verified").notNull().default(false),
});

export const graveRequests = pgTable("grave_requests", {
  id: id(),
  nameText: text("name_text").notNull(),
  locationText: text("location_text"),
  email: text("email"),
  locale: text("locale"),
  matchedGraveId: uuid("matched_grave_id").references(() => graves.id),
  createdAt: createdAt(),
});

export const partnerGraves = pgTable(
  "partner_graves",
  {
    partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
    graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.partnerId, t.graveId] })],
);

export const partnerAgreements = pgTable("partner_agreements", {
  id: id(),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  revenueShareBps: integer("revenue_share_bps").notNull().default(0),
  fixedMonthlyMinor: integer("fixed_monthly_minor"),
  currency: text("currency").notNull().default("ILS"),
  validFrom: ts("valid_from").notNull(),
  validTo: ts("valid_to"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const partnerSettlements = pgTable("partner_settlements", {
  id: id(),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  periodStart: ts("period_start").notNull(),
  periodEnd: ts("period_end").notNull(),
  currency: text("currency").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: createdAt(),
});

/* ───────────────────────────── devices ───────────────────────────── */

export const printerProfiles = pgTable("printer_profiles", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  model: text("model"),
  dotsPerMm: real("dots_per_mm").notNull(),
  widthDots: integer("width_dots").notNull(),
  /** Each capability is "verified" | "unverified" | "unsupported" — never assumed */
  capabilities: jsonb("capabilities").$type<Record<string, "verified" | "unverified" | "unsupported">>().notNull(),
  notes: text("notes"),
});

export const devices = pgTable(
  "devices",
  {
    id: id(),
    serial: text("serial").notNull(),
    name: text("name").notNull(),
    status: deviceStatusEnum("status").notNull().default("provisioning"),
    printerProfileId: text("printer_profile_id").references(() => printerProfiles.id),
    agentVersion: text("agent_version"),
    firmwareChannel: text("firmware_channel").notNull().default("stable"),
    paused: boolean("paused").notNull().default(false),
    lastSeenAt: ts("last_seen_at"),
    /** Latest telemetry snapshot (denormalized for fleet list); history in device_telemetry */
    lastTelemetry: jsonb("last_telemetry").$type<Record<string, unknown>>(),
    isSimulated: boolean("is_simulated").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("devices_serial_uq").on(t.serial)],
);

export const deviceCredentials = pgTable(
  "device_credentials",
  {
    id: id(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("device_credentials_hash_uq").on(t.tokenHash)],
);

export const devicePairingCodes = pgTable("device_pairing_codes", {
  id: id(),
  codeHash: text("code_hash").notNull(),
  graveId: uuid("grave_id").references(() => graves.id),
  deviceName: text("device_name").notNull(),
  printerProfileId: text("printer_profile_id").references(() => printerProfiles.id),
  createdBy: uuid("created_by"),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  deviceId: uuid("device_id").references(() => devices.id),
  createdAt: createdAt(),
});

export const deviceAssignments = pgTable(
  "device_assignments",
  {
    id: id(),
    deviceId: uuid("device_id").notNull().references(() => devices.id),
    graveId: uuid("grave_id").notNull().references(() => graves.id),
    assignedAt: ts("assigned_at").notNull().defaultNow(),
    unassignedAt: ts("unassigned_at"),
    /** Location is asserted by an admin, never auto-trusted from the device */
    assertedBy: uuid("asserted_by"),
    note: text("note"),
  },
  (t) => [index("device_assignments_grave_idx").on(t.graveId), index("device_assignments_device_idx").on(t.deviceId)],
);

export const deviceTelemetry = pgTable(
  "device_telemetry",
  {
    id: id(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    at: ts("at").notNull().defaultNow(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index("device_telemetry_device_at_idx").on(t.deviceId, t.at)],
);

export const deviceEvents = pgTable(
  "device_events",
  {
    id: id(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    /** Device-generated unique id → idempotent ingestion of retried uploads */
    eventUid: text("event_uid").notNull(),
    type: text("type").notNull(),
    severity: severityEnum("severity").notNull().default("info"),
    jobId: uuid("job_id"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    occurredAt: ts("occurred_at").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("device_events_uid_uq").on(t.deviceId, t.eventUid), index("device_events_device_idx").on(t.deviceId, t.occurredAt)],
);

export const deviceCommands = pgTable(
  "device_commands",
  {
    id: id(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    type: commandTypeEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    status: commandStatusEnum("status").notNull().default("pending"),
    /** HMAC over id|type|payload|expiresAt with the device's command key */
    signature: text("signature").notNull(),
    issuedBy: uuid("issued_by"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    deliveredAt: ts("delivered_at"),
    completedAt: ts("completed_at"),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("device_commands_device_status_idx").on(t.deviceId, t.status)],
);

export const firmwareReleases = pgTable("firmware_releases", {
  id: id(),
  version: text("version").notNull(),
  channel: text("channel").notNull().default("canary"),
  sha256: text("sha256").notNull(),
  signature: text("signature"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const rollouts = pgTable("rollouts", {
  id: id(),
  releaseId: uuid("release_id").notNull().references(() => firmwareReleases.id),
  percent: smallint("percent").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | running | paused | completed | rolled_back
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

export const deviceConfig = pgTable("device_config", {
  deviceId: uuid("device_id").primaryKey().references(() => devices.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  updatedAt: updatedAt(),
});

export const paperRolls = pgTable(
  "paper_rolls",
  {
    id: id(),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    installedAt: ts("installed_at").notNull().defaultNow(),
    removedAt: ts("removed_at"),
    outerDiameterMm: real("outer_diameter_mm").notNull(),
    coreDiameterMm: real("core_diameter_mm").notNull(),
    thicknessMm: real("thickness_mm").notNull(),
    nominalLengthMm: integer("nominal_length_mm"),
    usedMm: real("used_mm").notNull().default(0),
    calibrationFactor: real("calibration_factor"),
    installedBy: uuid("installed_by"),
    ticketId: uuid("ticket_id"),
    photoKey: text("photo_key"),
  },
  (t) => [index("paper_rolls_device_idx").on(t.deviceId)],
);

export const alertRules = pgTable("alert_rules", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  severity: severityEnum("severity").notNull().default("warning"),
  params: jsonb("params").$type<Record<string, number | string | boolean>>(),
});

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    kind: text("kind").notNull(),
    severity: severityEnum("severity").notNull(),
    status: alertStatusEnum("status").notNull().default("open"),
    deviceId: uuid("device_id").references(() => devices.id),
    graveId: uuid("grave_id").references(() => graves.id),
    dedupeKey: text("dedupe_key").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    openedAt: ts("opened_at").notNull().defaultNow(),
    acknowledgedAt: ts("acknowledged_at"),
    acknowledgedBy: uuid("acknowledged_by"),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [
    index("alerts_status_idx").on(t.status),
    uniqueIndex("alerts_open_dedupe_uq").on(t.dedupeKey).where(sql`status <> 'resolved'`),
  ],
);

export const maintenanceTickets = pgTable(
  "maintenance_tickets",
  {
    id: id(),
    graveId: uuid("grave_id").references(() => graves.id),
    deviceId: uuid("device_id").references(() => devices.id),
    alertId: uuid("alert_id").references(() => alerts.id),
    kind: text("kind").notNull(), // paper_change | cleaning | battery | sensor | cutter | other
    title: text("title").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    priority: smallint("priority").notNull().default(2),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id),
    dueAt: ts("due_at"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
    closedAt: ts("closed_at"),
  },
  (t) => [index("tickets_status_idx").on(t.status)],
);

export const maintenanceLogs = pgTable("maintenance_logs", {
  id: id(),
  ticketId: uuid("ticket_id").notNull().references(() => maintenanceTickets.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id"),
  note: text("note").notNull(),
  photoKey: text("photo_key"),
  createdAt: createdAt(),
});

/* ───────────────────────────── commerce ───────────────────────────── */

export const prices = pgTable(
  "prices",
  {
    id: id(),
    /** default | grave | country */
    scope: text("scope").notNull().default("default"),
    graveId: uuid("grave_id").references(() => graves.id),
    countryCode: text("country_code"),
    item: text("item").notNull(), // kvittel | extra_page | video_proof | bundle_discount_bps
    currency: text("currency").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    version: integer("version").notNull().default(1),
    validFrom: ts("valid_from").notNull().defaultNow(),
    validTo: ts("valid_to"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("prices_lookup_idx").on(t.item, t.currency, t.scope)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull(),
    kind: text("kind").notNull(), // percent | fixed
    value: integer("value").notNull(), // bps for percent, minor units for fixed
    currency: text("currency"),
    maxRedemptions: integer("max_redemptions"),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    validFrom: ts("valid_from"),
    validTo: ts("valid_to"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_code_uq").on(t.code)],
);

export const currencyRates = pgTable("currency_rates", {
  id: id(),
  base: text("base").notNull(),
  quote: text("quote").notNull(),
  rate: real("rate").notNull(),
  source: text("source").notNull(),
  fetchedAt: ts("fetched_at").notNull(),
});

export const kvittels = pgTable("kvittels", {
  id: id(),
  /** AES-256-GCM envelope of the KvittelContent JSON. Never stored or logged in plaintext. */
  contentEnc: text("content_enc"),
  contentDigest: text("content_digest").notNull(),
  template: text("template").notNull(),
  nusach: text("nusach").notNull(),
  pageCount: smallint("page_count").notNull(),
  lengthMm: real("length_mm").notNull(),
  layoutVersion: text("layout_version").notNull(),
  retentionUntil: ts("retention_until"),
  purgedAt: ts("purged_at"),
  createdAt: createdAt(),
});

export const kvittelFiles = pgTable("kvittel_files", {
  id: id(),
  kvittelId: uuid("kvittel_id").references(() => kvittels.id, { onDelete: "cascade" }),
  uploadToken: text("upload_token").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  encrypted: boolean("encrypted").notNull().default(true),
  createdAt: createdAt(),
});

export const orders = pgTable(
  "orders",
  {
    id: id(),
    publicRef: text("public_ref").notNull(),
    userId: uuid("user_id").references(() => users.id),
    email: text("email").notNull(),
    locale: text("locale").notNull(),
    currency: text("currency").notNull(),
    subtotalMinor: integer("subtotal_minor").notNull(),
    discountMinor: integer("discount_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    couponId: uuid("coupon_id").references(() => coupons.id),
    /** Snapshot of the price rows used — the legal price at order time */
    priceSnapshot: jsonb("price_snapshot").$type<Record<string, unknown>>().notNull(),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    source: text("source").notNull().default("web"),
    countryHint: text("country_hint"),
    /** Client-generated key: a repeated submit of the same checkout returns the same order instead of charging twice */
    idempotencyKey: text("idempotency_key"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    paidAt: ts("paid_at"),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_ref_uq").on(t.publicRef),
    uniqueIndex("orders_idem_uq").on(t.idempotencyKey),
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_email_idx").on(t.email),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    graveId: uuid("grave_id").notNull().references(() => graves.id),
    kvittelId: uuid("kvittel_id").notNull().references(() => kvittels.id),
    pages: smallint("pages").notNull().default(1),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    extrasMinor: integer("extras_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    status: itemStatusEnum("status").notNull().default("pending_payment"),
    /** If the grave cannot print now, the earliest allowed local window (UTC) */
    scheduledFor: ts("scheduled_for"),
    deliveredAt: ts("delivered_at"),
    deliveryConfidence: text("delivery_confidence"), // sensor_confirmed | printer_reported | manual
    createdAt: createdAt(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_grave_idx").on(t.graveId)],
);

export const printJobs = pgTable(
  "print_jobs",
  {
    id: id(),
    /** null for operator test prints */
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }),
    graveId: uuid("grave_id").notNull().references(() => graves.id),
    deviceId: uuid("device_id").references(() => devices.id),
    /** Idempotency key for the device — one physical print per command id */
    commandId: text("command_id").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    notBefore: ts("not_before"),
    leaseId: text("lease_id"),
    leaseExpiresAt: ts("lease_expires_at"),
    attempts: smallint("attempts").notNull().default(0),
    rasterDigest: text("raster_digest"),
    lengthMm: real("length_mm"),
    confidence: text("confidence"),
    lastError: text("last_error"),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deliveredAt: ts("delivered_at"),
  },
  (t) => [
    uniqueIndex("print_jobs_command_uq").on(t.commandId),
    index("print_jobs_status_idx").on(t.status, t.graveId),
    index("print_jobs_device_idx").on(t.deviceId),
  ],
);

export const printAttempts = pgTable(
  "print_attempts",
  {
    id: id(),
    jobId: uuid("job_id").notNull().references(() => printJobs.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => devices.id),
    attemptNo: smallint("attempt_no").notNull(),
    leaseId: text("lease_id").notNull(),
    leasedAt: ts("leased_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    printedAt: ts("printed_at"),
    cutAt: ts("cut_at"),
    chuteAt: ts("chute_at"),
    outcome: text("outcome"), // delivered | failed_before_print | uncertain | expired
    error: text("error"),
  },
  (t) => [uniqueIndex("print_attempts_lease_uq").on(t.leaseId)],
);

export const proofMedia = pgTable("proof_media", {
  id: id(),
  jobId: uuid("job_id").notNull().references(() => printJobs.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  durationMs: integer("duration_ms"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const orderTrackingTokens = pgTable(
  "order_tracking_tokens",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tracking_token_uq").on(t.tokenHash)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref").notNull(),
    status: paymentStatusEnum("status").notNull().default("created"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    feeMinor: integer("fee_minor"),
    refundedMinor: integer("refunded_minor").notNull().default(0),
    /** Hosted checkout URL of a real provider, so an interrupted payment can be resumed */
    checkoutUrl: text("checkout_url"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    succeededAt: ts("succeeded_at"),
  },
  (t) => [uniqueIndex("payments_provider_ref_uq").on(t.provider, t.providerRef), index("payments_order_idx").on(t.orderId)],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    paymentId: uuid("payment_id").references(() => payments.id),
    signatureValid: boolean("signature_valid").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    outcome: text("outcome"),
  },
  (t) => [uniqueIndex("payment_events_uq").on(t.provider, t.eventId)],
);

export const refunds = pgTable("refunds", {
  id: id(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  reason: text("reason").notNull(),
  status: refundStatusEnum("status").notNull().default("requested"),
  requestedBy: uuid("requested_by"),
  approvedBy: uuid("approved_by"),
  providerRef: text("provider_ref"),
  createdAt: createdAt(),
});

/* ───────────────────────────── account features ───────────────────────────── */

export const savedPeople = pgTable("saved_people", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupName: text("group_name").notNull(),
  contentEnc: text("content_enc").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const savedTemplates = pgTable("saved_templates", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentEnc: text("content_enc").notNull(),
  createdAt: createdAt(),
});

export const favoriteGraves = pgTable(
  "favorite_graves",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    graveId: uuid("grave_id").notNull().references(() => graves.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.graveId] })],
);

export const scheduledDeliveries = pgTable("scheduled_deliveries", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  graveId: uuid("grave_id").notNull().references(() => graves.id),
  savedTemplateId: uuid("saved_template_id").references(() => savedTemplates.id),
  rule: text("rule").notNull(), // e.g. "hilula", "rosh_chodesh", "date:2027-03-01"
  active: boolean("active").notNull().default(false),
  createdAt: createdAt(),
});

export const reminderSubscriptions = pgTable("reminder_subscriptions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  graveId: uuid("grave_id").references(() => graves.id),
  kind: text("kind").notNull(), // hilula | rosh_chodesh | yahrzeit
  hebrewDay: smallint("hebrew_day"),
  hebrewMonth: smallint("hebrew_month"),
  label: text("label"),
  channel: text("channel").notNull().default("email"),
  createdAt: createdAt(),
});

/* ───────────────────────────── content & platform ───────────────────────────── */

export const pages = pgTable(
  "pages",
  {
    id: id(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull().default("page"), // page | faq | legal
    published: boolean("published").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pages_slug_uq").on(t.slug)],
);

export const pageTranslations = pgTable(
  "page_translations",
  {
    id: id(),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metaDescription: text("meta_description"),
    reviewed: boolean("reviewed").notNull().default(false),
  },
  (t) => [uniqueIndex("page_translations_uq").on(t.pageId, t.locale)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

export const outboundEmails = pgTable(
  "outbound_emails",
  {
    id: id(),
    to: text("to").notNull(),
    template: text("template").notNull(),
    locale: text("locale").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("queued"),
    createdAt: createdAt(),
  },
  (t) => [index("outbound_emails_to_idx").on(t.to)],
);
