import { z } from "zod";

export const assistedAuditCompanyIdSchema = z.string().uuid();
