// Synthetic positive fixture aligned with the local canonical certification.
// No customer facts, credentials or mutation are defined here.
export const audit = {
  companyName: "CERT-STAGING synthetic invoice audit",
  industry: "Business operations services",
  processName: "Manual supplier invoice processing",
  // Positive certification fixture: explicitly declared measurement, not inferred from
  // headcount. Missing knowledge remains a blocking negative engine test.
  kpiStatement:
    "The finance team tracks a monthly invoice-volume KPI: 85 invoices in the reference month, with 45 manual hours recorded for the same process.",
};

export function discoveryPayloads() {
  return [
    {
      step: "company",
      industry: audit.industry,
      countryCode: "FR",
      employeeCount: 42,
      description:
        "The company runs recurring finance and operations workflows, including manual supplier invoice intake and approvals.",
    },
    {
      step: "business",
      businessModel: "B2B services",
      growthStage: "growth",
      revenueAmount: 1_200_000,
      revenueCurrency: "EUR",
      revenueYear: 2026,
      offerings: [
        {
          type: "service",
          name: "Managed operations",
          description: "Recurring back-office operations support.",
        },
        {
          type: "service",
          name: "Financial administration",
          description: "Supplier invoice administration and payment preparation.",
        },
      ],
      objectives: [
        {
          title: "Reduce supplier invoice cycle time",
          description: "Shorten the delay between invoice receipt and approval.",
          priority: 5,
          targetDate: null,
        },
        {
          title: "Remove duplicate manual entry",
          description: "Avoid retyping invoice data across spreadsheet and ERP tools.",
          priority: 5,
          targetDate: null,
        },
      ],
      challenges: [
        {
          title: "Duplicate invoice entry",
          description: "Invoice data is copied from email to spreadsheets and accounting software.",
          severity: 5,
        },
        {
          title: "Approval delay",
          description: "Approvals wait when the finance manager is unavailable.",
          severity: 4,
        },
      ],
    },
    {
      step: "organization",
      departments: [
        {
          clientId: "finance",
          name: "Finance",
          description: "Owns supplier invoices, approvals, and payment preparation.",
          headcount: 6,
        },
        {
          clientId: "operations",
          name: "Operations",
          description: "Coordinates incoming supplier documents and exception follow-up.",
          headcount: 12,
        },
      ],
      roles: [
        {
          departmentClientId: "finance",
          title: "Finance Manager",
          headcount: 1,
          responsibilities: ["Approve invoices", "Resolve exceptions", "Validate payments"],
        },
        {
          departmentClientId: "finance",
          title: "Accounting Assistant",
          headcount: 3,
          responsibilities: ["Read invoice emails", "Enter invoice data", "Update spreadsheets"],
        },
        {
          departmentClientId: "operations",
          title: "Operations Coordinator",
          headcount: 2,
          responsibilities: ["Chase missing supplier data", "Track invoice status"],
        },
      ],
    },
    {
      step: "software",
      items: [
        {
          name: "Gmail",
          purpose: "Supplier invoice email intake",
          criticality: 5,
          usersCount: 8,
        },
        {
          name: "Google Sheets",
          purpose: "Manual invoice tracking",
          criticality: 5,
          usersCount: 7,
        },
        {
          name: "Accounting ERP",
          purpose: "Invoice accounting and payment preparation",
          criticality: 5,
          usersCount: 5,
        },
        { name: "Bank Portal", purpose: "Payment review", criticality: 3, usersCount: 2 },
      ],
    },
    {
      step: "processes",
      items: [
        {
          name: audit.processName,
          categoryCode: "finance",
          description:
            "Supplier invoices arrive by email, are manually checked, copied into a spreadsheet, approved by the finance manager, and then re-entered into the accounting ERP.",
          frequency: "weekly",
          volume: 85,
          manualHoursMonth: 45,
          painPoints: [
            "Manual data entry from invoice email to spreadsheet",
            "Duplicate entry into accounting ERP",
            "Approval delays when one approver is absent",
            "No reliable status visibility for exceptions",
          ],
        },
      ],
    },
    { step: "review", confirmed: true },
  ];
}

export function nextQuestion(view) {
  if (view?.nextQuestion) return view.nextQuestion;
  const answers = new Set((view?.answers ?? []).map((answer) => answer.questionId));
  return (view?.questions ?? []).find(
    (question) => question.mandatory && !answers.has(question.id),
  );
}

export function answerFor(question) {
  const text =
    `${question.label ?? ""} ${question.code ?? ""} ${question.helpText ?? ""}`.toLowerCase();
  const type = question.type ?? question.answerType;
  if (type === "boolean") return true;
  if (type === "number") {
    if (/hour|time|duration|temps|manual/.test(text)) return 45;
    if (/cost|rate|price|co[uû]t/.test(text)) return 38;
    if (/volume|frequency|count|invoice/.test(text)) return 85;
    return 7;
  }
  if (type === "single_choice") return firstOption(question);
  if (type === "multiple_choice") return [firstOption(question)].filter(Boolean);
  return `Supplier invoice processing is manual: invoices arrive by email, data is copied into a spreadsheet, approval waits on one finance manager, then the data is re-entered into the accounting ERP. Around 85 invoices are handled monthly and roughly 45 hours are spent each month. ${audit.kpiStatement}`;
}

function firstOption(question) {
  const options = question.options ?? question.choices ?? [];
  const first = options[0];
  if (typeof first === "string") return first;
  return first?.value ?? first?.id ?? first?.label ?? "yes";
}
