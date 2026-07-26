import { z } from "zod";
export const reportIdSchema = z.string().uuid();
