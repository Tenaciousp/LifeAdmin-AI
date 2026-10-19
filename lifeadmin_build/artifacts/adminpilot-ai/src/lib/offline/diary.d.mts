export const diaryDates: {id: string; label: string}[];
export function validDiaryDate(value: unknown): boolean;
export function diaryEvents(tasks: Record<string, any>[]): {key: string; title: string; date: string; leadDays: number}[];
