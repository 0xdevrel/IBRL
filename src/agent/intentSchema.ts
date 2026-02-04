import { z } from 'zod';

export const SupportedAsset = z.enum(['SOL', 'USDC']);

export const IntentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CHAT'),
    message: z.string().min(1),
  }),
  z.object({
    kind: z.literal('SWAP'),
    from: SupportedAsset,
    to: SupportedAsset,
    amount: z.object({
      value: z.number().positive(),
      unit: z.literal('SOL'),
    }),
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('EXIT_TO_USDC'),
    amount: z.object({
      value: z.number().positive(),
      unit: z.literal('SOL'),
    }),
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('UNSUPPORTED'),
    reason: z.string().min(1),
  }),
]);

export type Intent = z.infer<typeof IntentSchema>;
