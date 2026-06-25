import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const jobs = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/jobs" }),
    schema: z.object({
        title: z.string(),
        status: z.enum(["Open", "Closed"]).default("Open"),
        order: z.number().optional(),
    }),
});

export const collections = { jobs };
