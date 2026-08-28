import { z } from "zod";
export const extractedFieldSchema=z.object({field:z.string().min(1),value:z.unknown(),confidence:z.number().min(0).max(100)});
export const importConfirmationSchema=z.object({jobId:z.string().cuid(),customerId:z.string().cuid().optional(),items:z.array(z.object({name:z.string(),productId:z.string().cuid().optional(),quantity:z.number().positive(),unitId:z.string().cuid(),confidence:z.number().min(0).max(100)})).min(1)});
