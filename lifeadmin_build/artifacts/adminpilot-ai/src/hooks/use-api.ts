import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetcher(url: string, options: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
      "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Connection problem. Check your internet connection and try again.");
  }
  if (!res.ok) {
    let errorMsg = await res.text();
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed.error) errorMsg = parsed.error;
    } catch {}
    throw new Error(errorMsg || "Something went wrong. Please try again.");
  }
  return res.json();
}

// GET /api/catalog
export function useCatalog() {
  return useQuery({
    queryKey: ["/api/catalog"],
    queryFn: () => fetcher("/api/catalog"),
  });
}

// POST /api/suggest
export function useSuggestMatch() {
  return useMutation({
    mutationFn: (query: string) => fetcher("/api/suggest", {
      method: "POST",
      body: JSON.stringify({ query })
    }),
  });
}

// GET /api/notes
export function useNotes(userId: string) {
  return useQuery({
    queryKey: ["/api/notes", userId],
    queryFn: () => fetcher("/api/notes"),
    enabled: !!userId,
  });
}

// GET /api/tasks
export function useTasks(userId: string) {
  return useQuery({
    queryKey: ["/api/tasks", userId],
    queryFn: () => fetcher("/api/tasks"),
    enabled: !!userId,
  });
}

// POST /api/tasks
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.user_id] });
    }
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher("/api/tasks/update", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.user_id] });
    }
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher("/api/tasks/delete", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.user_id] });
    }
  });
}

// POST /api/agent
export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetcher("/api/agent", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", variables.user_id] });
    },
  });
}

// GET /api/admin/overview
export function useAdminOverview() {
  return useQuery({
    queryKey: ["/api/admin/overview"],
    queryFn: () => fetcher("/api/admin/overview"),
    retry: false, // Don't retry on 403
  });
}

export function useAuthMe() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => fetcher("/api/auth/me").catch(() => ({ authenticated: false })),
  });
}

export function useProducts(userId: string) {
  return useQuery({
    queryKey: ["/api/products", userId],
    queryFn: () => fetcher("/api/products"),
    enabled: !!userId,
  });
}
