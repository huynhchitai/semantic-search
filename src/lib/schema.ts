import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/index
// ---------------------------------------------------------------------------

export const DocSchema = z.object({
  title: z.string().min(1, 'title must not be empty').max(500, 'title max 500 chars'),
  content: z.string().min(1, 'content must not be empty').max(100_000, 'content max 100,000 chars per doc'),
  // Scheme allowlist: z.string().url() alone accepts `javascript:`/`data:` URIs,
  // which would become a stored-XSS payload once rendered as an <a href>. Require http(s).
  url: z
    .string()
    .url('url must be a valid URL')
    .refine((u) => /^https?:\/\//i.test(u), 'url must use the http or https scheme')
    .optional(),
});

export const IndexRequestSchema = z
  .object({
    docs: z
      .array(DocSchema)
      .min(1, 'must provide at least 1 document')
      .max(50, 'maximum 50 documents per request'),
  })
  .superRefine((val, ctx) => {
    const totalChars = val.docs.reduce((sum, d) => sum + d.title.length + d.content.length, 0);
    if (totalChars > 200_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 200_000,
        origin: 'string',
        inclusive: true,
        message: `Total characters across all docs must not exceed 200,000 (got ${totalChars})`,
        path: ['docs'],
      });
    }
  });

export type IndexRequest = z.infer<typeof IndexRequestSchema>;

// ---------------------------------------------------------------------------
// POST /api/search
// ---------------------------------------------------------------------------

export const SearchRequestSchema = z.object({
  query: z
    .string()
    .min(2, 'query must be at least 2 characters')
    .max(300, 'query max 300 characters'),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
