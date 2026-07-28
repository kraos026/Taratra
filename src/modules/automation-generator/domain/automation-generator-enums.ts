export enum GenerationStatus {
  Requested = "REQUESTED",
  Generated = "GENERATED",
  Published = "PUBLISHED",
  Deprecated = "DEPRECATED",
}

export enum NodeType {
  Trigger = "TRIGGER",
  Action = "ACTION",
  Condition = "CONDITION",
  Transform = "TRANSFORM",
  Loop = "LOOP",
  Parallel = "PARALLEL",
  Join = "JOIN",
  Delay = "DELAY",
  HumanApproval = "HUMAN_APPROVAL",
  SubWorkflow = "SUB_WORKFLOW",
  ErrorHandler = "ERROR_HANDLER",
  Compensation = "COMPENSATION",
  End = "END",
}

export enum EdgeType {
  Success = "SUCCESS",
  Failure = "FAILURE",
  Conditional = "CONDITIONAL",
  Timeout = "TIMEOUT",
  Compensation = "COMPENSATION",
  Default = "DEFAULT",
}

export enum CapabilityClassification {
  Consumed = "CONSUMED",
  Transformed = "TRANSFORMED",
  Ignored = "IGNORED",
  Unsupported = "UNSUPPORTED",
  Defaulted = "DEFAULTED",
}

export enum PortDirection {
  Input = "INPUT",
  Output = "OUTPUT",
}

export enum VariableScope {
  Graph = "GRAPH",
  Node = "NODE",
  Loop = "LOOP",
}

export enum GenerationRuleStatus {
  Draft = "DRAFT",
  Published = "PUBLISHED",
  Retired = "RETIRED",
}

export enum GenerationRuleType {
  Projection = "PROJECTION",
  Policy = "POLICY",
  Default = "DEFAULT",
}
