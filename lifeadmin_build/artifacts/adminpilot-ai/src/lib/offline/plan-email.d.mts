type Segment = { start: number; end: number; header: string; subject: string; message: string };
export function locateEmail(plan: string): Segment | null;
export function replaceEmail(plan: string, segment: Segment, subject: string, message: string): string;
export function savedPlanEmail(plan: any): { subject: string; body: string; kind: string } | null;
