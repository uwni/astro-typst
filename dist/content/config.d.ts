import { z } from 'astro:content';
export declare const collections: {
    typ: import("astro:content").CollectionConfig<z.ZodObject<{
        title: z.ZodString;
        author: z.ZodOptional<z.ZodString>;
        desc: z.ZodOptional<z.ZodAny>;
        date: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        title: string;
        date?: any;
        author?: string | undefined;
        desc?: any;
    }, {
        title: string;
        date?: any;
        author?: string | undefined;
        desc?: any;
    }>>;
};
//# sourceMappingURL=config.d.ts.map