export type PlanSections = { bill: string; recommendation: string; alternatives: string; actions: string; savings: string };
export function extractPlanSections(text: string): PlanSections;
