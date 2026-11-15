import { z } from "zod";
import { BRAND_GROUPS } from "./brands";

export const BrandGroupSchema = z.enum(BRAND_GROUPS);

export const ParsedJobSchema = z.object({
  brand: z.string().nullable(),
  model: z.string().nullable(),
  errorCodes: z.array(z.string()),
  symptoms: z.array(z.string()),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  missingInfo: z.array(z.string()),
});
export type ParsedJob = z.infer<typeof ParsedJobSchema>;

export const DiagnosisSchema = z.object({
  causes: z.array(
    z.object({
      title: z.string(),
      probability: z.number(),
      reasoning: z.string(),
      priceItem: z.string().nullable(),
    }),
  ),
  checks: z.array(z.object({ step: z.string(), expected: z.string().nullable() })),
  questions: z.array(z.string()),
  safetyWarnings: z.array(z.string()),
  unknownCodes: z.array(z.string()),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const PriceMatchSchema = z.union([
  z.object({
    priceItem: z.string(),
    group: BrandGroupSchema,
    minTl: z.number(),
    maxTl: z.number(),
    duration: z.string(),
  }),
  z.object({ priceItem: z.string(), missing: z.literal(true) }),
]);
export type PriceMatch = z.infer<typeof PriceMatchSchema>;

export const CustomerMessageSchema = z.object({ text: z.string() });
export type CustomerMessage = z.infer<typeof CustomerMessageSchema>;

export const RepairRecordDraftSchema = z.object({
  actualFault: z.string(),
  actions: z.array(z.string()),
  partsReplaced: z.array(z.string()),
});
export type RepairRecordDraft = z.infer<typeof RepairRecordDraftSchema>;
