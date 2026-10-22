export const billGroups: Array<{ id: string; label: string; category_id: string; types: Array<{ id: string; label: string; detail_key: string; detail_value: string; category_id: string }> }>;
export function groupForCategory(categoryId: string): (typeof billGroups)[number] | undefined;
export function resolveBillType(task: any): { group: (typeof billGroups)[number]; type: (typeof billGroups)[number]["types"][number] } | null;
