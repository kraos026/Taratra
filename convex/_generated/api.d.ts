/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditCatalogue from "../auditCatalogue.js";
import type * as auditCatalogueData from "../auditCatalogueData.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as companies from "../companies.js";
import type * as discovery from "../discovery.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as interviewCatalogue from "../interviewCatalogue.js";
import type * as interviewCatalogueData from "../interviewCatalogueData.js";
import type * as interviews from "../interviews.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_auditRepository from "../lib/auditRepository.js";
import type * as lib_businessId from "../lib/businessId.js";
import type * as lib_companyRepository from "../lib/companyRepository.js";
import type * as lib_discoveryRepository from "../lib/discoveryRepository.js";
import type * as lib_interviewRepository from "../lib/interviewRepository.js";
import type * as lib_modelRecord from "../lib/modelRecord.js";
import type * as modelSchema from "../modelSchema.js";
import type * as workspaces from "../workspaces.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  auditCatalogue: typeof auditCatalogue;
  auditCatalogueData: typeof auditCatalogueData;
  audits: typeof audits;
  auth: typeof auth;
  companies: typeof companies;
  discovery: typeof discovery;
  health: typeof health;
  http: typeof http;
  interviewCatalogue: typeof interviewCatalogue;
  interviewCatalogueData: typeof interviewCatalogueData;
  interviews: typeof interviews;
  "lib/access": typeof lib_access;
  "lib/auditRepository": typeof lib_auditRepository;
  "lib/businessId": typeof lib_businessId;
  "lib/companyRepository": typeof lib_companyRepository;
  "lib/discoveryRepository": typeof lib_discoveryRepository;
  "lib/interviewRepository": typeof lib_interviewRepository;
  "lib/modelRecord": typeof lib_modelRecord;
  modelSchema: typeof modelSchema;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
