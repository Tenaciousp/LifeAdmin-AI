export function calendarAvailable(): boolean;
export function chooseCalendars(): Promise<{id: string; title: string}[]>;
export function syncDiary(calendarId: string, events: {key: string; title: string; date: string; leadDays: number}[]): Promise<{count: number; skippedPast: number}>;
export function removeDiaryEntries(): Promise<void>;
