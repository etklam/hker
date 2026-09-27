import { z } from "zod";
const id = z.number().int().positive();
const optionalId = id.nullable().default(null);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens",
  );
const price = z
  .number()
  .finite()
  .min(0)
  .max(9999999999.99)
  .multipleOf(0.01, "Use at most two decimal places")
  .nullable()
  .default(null);
const order = z.number().int().min(-1000000).max(1000000).default(0);
const rangeValid = (v: { priceMin: number | null; priceMax: number | null }) =>
  v.priceMin === null || v.priceMax === null || v.priceMax >= v.priceMin;
export const linkTypes = [
  "website",
  "telegram",
  "instagram",
  "facebook",
  "whatsapp",
  "map",
  "youtube",
  "phone",
  "email",
  "other",
] as const;
export const linkSchema = z.object({
  id: id.optional(),
  type: z.enum(linkTypes),
  label: z.string().trim().min(1).max(100),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          ["https:", "http:", "tel:", "mailto:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }, "Use an http, https, tel or mailto URL"),
  sortOrder: order,
  enabled: z.boolean().default(true),
}).refine(v => v.type === "phone" ? v.url.startsWith("tel:") : v.type === "email" ? v.url.startsWith("mailto:") : /^https?:\/\//i.test(v.url), { message: "Link type and URL scheme do not match", path: ["url"] });
export const listingSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    revision: id.optional(),
    aliases: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
    slug,
    shortDescription: z.string().trim().max(300).default(""),
    description: z.string().trim().max(20000).default(""),
    categoryId: optionalId,
    areaId: optionalId,
    priceMin: price,
    priceMax: price,
    priceCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("HKD"),
    attrs: z
      .record(z.string().min(1).max(80), z.string().max(1000))
      .refine(v => Object.keys(v).length <= 30, "At most 30 public attributes")
      .default({}),
    featured: z.boolean().default(false),
    enabled: z.boolean().default(false),
    sortOrder: order,
    tagIds: z.array(id).max(50).default([]),
    links: z.array(linkSchema).max(30).default([]),
  })
  .refine(rangeValid, {
    message: "Maximum price must be at least minimum price",
    path: ["priceMax"],
  });
const taxonomyBase = z.object({
  name: z.string().trim().min(1).max(100),
  slug,
  enabled: z.boolean().default(true),
  sortOrder: order,
});
export const taxonomySchemas = {
  categories: taxonomyBase.extend({
    description: z.string().max(1000).nullable().default(null),
    icon: z.string().max(100).nullable().default(null),
  }),
  areas: taxonomyBase.extend({ parentId: optionalId }),
  tags: taxonomyBase.extend({
    groupId: optionalId,
    publicVisible: z.boolean().default(true),
    botVisible: z.boolean().default(true),
    botFeatured: z.boolean().default(false),
    filterable: z.boolean().default(true),
    aliases: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  }),
  groups: taxonomyBase.extend({
    publicVisible: z.boolean().default(true),
    botVisible: z.boolean().default(true),
  }),
  navigation: z
    .object({
      label: z.string().trim().min(1).max(100),
      allowBroad: z.boolean().default(false),
      placement: z.enum(["public", "bot", "both"]).default("both"),
      icon: z.string().max(100).nullable().default(null),
      categoryId: optionalId,
      areaId: optionalId,
      priceMin: price,
      priceMax: price,
      matchMode: z.enum(["and", "or"]).default("and"),
      tagIds: z.array(id).max(20).default([]),
      enabled: z.boolean().default(true),
      sortOrder: order,
    })
    .refine(rangeValid, { message: "Invalid price range" }),
};
export type TaxonomyKind = keyof typeof taxonomySchemas;
export type ListingInput = z.infer<typeof listingSchema>;
export const searchSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    categoryId: id.optional(),
    areaId: id.optional(),
    tagIds: z.array(id).max(50).default([]),
    tagMatchMode: z.enum(["and", "or"]).default("and"),
    priceMin: price,
    priceMax: price,
    page: z.number().int().min(1).max(10000).default(1),
    pageSize: z.number().int().min(1).max(100).default(12),
    requestedSort: z.enum(["auto", "relevance", "manual", "newest", "price-asc", "price-desc"]).optional(),
    sort: z
      .enum(["auto", "relevance", "manual", "newest", "price-asc", "price-desc"])
      .optional(),
    featured: z.boolean().optional(),
    status: z.enum(["all", "enabled", "disabled"]).default("all"),
  })
  .refine(rangeValid, { message: "Invalid price range" })
  .transform(v => {
    const query = v.query.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
    const requestedSort = v.requestedSort ?? v.sort ?? "auto";
    return {
      ...v,
      query,
      tagIds: [...new Set(v.tagIds)].sort((a, b) => a - b),
      requestedSort,
      sort: requestedSort === "auto" ? (query ? "relevance" as const : "manual" as const) : requestedSort,
    };
  });
export type SearchInput = z.input<typeof searchSchema>;
export type SearchState = z.output<typeof searchSchema>;
