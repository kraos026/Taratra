export const questionTypes = [
  "short_text",
  "long_text",
  "number",
  "boolean",
  "single_choice",
  "multiple_choice",
  "percentage",
  "currency",
  "date",
] as const;
export const versionStatuses = ["draft", "published", "archived"] as const;
export type QuestionType = (typeof questionTypes)[number];
export type VersionStatus = (typeof versionStatuses)[number];
export type ValidationRules = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};
export type QuestionDefinition = {
  questionType: QuestionType;
  optionsJson?: unknown;
  validationJson?: unknown;
};
export type QuestionnairePermissions = { canManage: boolean; canUse: boolean };
