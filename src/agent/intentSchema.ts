import { z } from 'zod';

export const SupportedAsset = z.enum(['SOL', 'USDC']);
export const AmountUnit = z.enum(['SOL', 'USDC']);

export const AmountSchema = z.object({
  value: z.number().positive(),
  unit: AmountUnit,
});

export const IntentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CHAT'),
    message: z.string().min(1),
  }),
  z.object({
    kind: z.literal('PORTFOLIO_QA'),
    question: z.string().min(1),
  }),
  z.object({
    kind: z.literal('PRICE_TRIGGER_EXIT'),
    amount: AmountSchema.extend({ unit: z.literal('SOL') }),
    thresholdUsd: z.number().positive(),
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('PRICE_TRIGGER_ENTRY'),
    amount: AmountSchema.extend({ unit: z.literal('USDC') }),
    thresholdUsd: z.number().positive(),
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('DCA_SWAP'),
    from: SupportedAsset,
    to: SupportedAsset,
    amount: AmountSchema,
    intervalMinutes: z.number().int().min(5).max(24 * 60),
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('SWAP'),
    from: SupportedAsset,
    to: SupportedAsset,
    amount: AmountSchema,
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('EXIT_TO_USDC'),
    amount: AmountSchema.extend({ unit: z.literal('SOL') }),
    slippageBps: z.number().int().min(1).max(200),
  }),
  z.object({
    kind: z.literal('UNSUPPORTED'),
    reason: z.string().min(1),
  }),
]);

export type Intent = z.infer<typeof IntentSchema>;
