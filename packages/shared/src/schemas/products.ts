import { z } from 'zod';
import { ProductClass, ProductType } from '../enums.js';

export const CreateManufacturerSchema = z.object({
  legalName: z.string().min(1),
  displayName: z.string().optional(),
  euEstablishmentCountry: z.string().optional(),
  mainEstablishmentAddress: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  responsiblePersonEu: z.string().optional(),
});

export const UpdateManufacturerSchema = CreateManufacturerSchema.partial();

// Trimmed for the PSIRT/reporting-only fork: only fields needed to identify a
// product in a case/report and route it to the right owners. Attack-surface,
// boot-chain, crypto-boundary, connectivity and market-lifecycle fields
// belonged to the dropped TARA/conformity modules and are not carried over.
export const CreateProductSchema = z.object({
  manufacturerId: z.string().uuid(),
  productName: z.string().min(1),
  modelNumber: z.string().optional(),
  sku: z.string().optional(),
  productClass: z.enum(ProductClass).default('default'),
  productType: z.enum(ProductType),
  intendedUse: z.string().optional(),
  firstPlacedOnMarketDate: z.string().date().optional(),
  productOwner: z.string().optional(),
  securityOwner: z.string().optional(),
  engineeringOwner: z.string().optional(),
  psirtLead: z.string().optional(),
  supportEscalationContacts: z.array(z.string()).default([]),
});

export const UpdateProductSchema = CreateProductSchema.omit({ manufacturerId: true }).partial();

export type CreateManufacturerInput = z.infer<typeof CreateManufacturerSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
