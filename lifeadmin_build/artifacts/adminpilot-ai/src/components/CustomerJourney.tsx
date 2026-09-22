import { useEffect, useState, useRef } from "react";
import { useTasks, useNotes, useCreateTask, useGeneratePlan, useUpdateTask, useDeleteTask, useSuggestMatch, useCatalog } from "@/hooks/use-api";
import { getBuyerId } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";
import { ChevronDown, Loader2, Info, MoreHorizontal, Mail, Copy, Bot, Search, Zap, Trash2, ExternalLink } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function CustomerJourney() {
  const buyerId = getBuyerId();
  const { data: tasksData, isLoading: tasksLoading } = useTasks(buyerId);
  const { data: notesData, isLoading: notesLoading } = useNotes(buyerId);
  const { data: catalog, isLoading: catalogLoading } = useCatalog();
  const suggestMatch = useSuggestMatch();
  
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const generatePlan = useGeneratePlan();

  const tasks = tasksData?.tasks || [];
  const savedPlans = notesData?.notes || [];
  const categories = catalog?.categories || [];
  const goals = catalog?.goals || [];
  const popular = catalog?.popular_choices || catalog?.popular || [];

  const [activeStep, setActiveStep] = useState(1);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestedMatch, setSuggestedMatch] = useState<any>(null);
  const [isBrowseAllOpen, setIsBrowseAllOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [planResult, setPlanResult] = useState<any>(null);
  const [providerEmail, setProviderEmail] = useState<{subject: string, body: string, kind?: string} | null>(null);
  const [activeTab, setActiveTab] = useState("next_steps");

  const [gapModalOpen, setGapModalOpen] = useState(false);
  const [detectedGaps, setDetectedGaps] = useState<string[]>([]);
  const [pendingGenerationTask, setPendingGenerationTask] = useState<any>(null);
  
  const [aiHandoffOpen, setAiHandoffOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiHandoffMode, setAiHandoffMode] = useState<"review" | "compare">("review");
  const aiPromptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!aiHandoffOpen) return;
    const timer = window.setTimeout(() => {
      const el = aiPromptRef.current;
      if (!el) return;
      el.scrollTop = 0;
      el.setSelectionRange(0, 0);
      el.blur();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [aiHandoffOpen, aiHandoffMode, aiPrompt]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    trackEvent("picker_searched", { query_length: searchQuery.length });
    suggestMatch.mutate(searchQuery, {
      onSuccess: (data) => {
        setSuggestedMatch(data);
        setIsBrowseAllOpen(false);
      },
      onError: () => {
        toast.error("Could not find a match. Please select manually.");
        setIsBrowseAllOpen(true);
      }
    });
  };

  const acceptSuggestion = () => {
    if (!suggestedMatch?.category_id) {
      toast.error("Choose the closest bill type below.");
      setIsBrowseAllOpen(true);
      return;
    }
    setSelectedCategory(suggestedMatch.category_id);
    setSelectedGoal(suggestedMatch.goal_id || null);
    trackEvent("suggestion_accepted", { category: suggestedMatch.category_id, goal: suggestedMatch.goal_id || "unspecified" });

    const cat = categories.find((c: any) => c.id === suggestedMatch.category_id);
    const gl = goals.find((g: any) => g.id === suggestedMatch.goal_id);
    setTitle(gl ? `${gl.label}: ${cat?.label.toLowerCase()}` : "");
    setDynamicFields({});
    setNotes("");
    setSuggestedMatch(null);
    setSearchQuery("");
    setActiveStep(suggestedMatch.goal_id ? 3 : 2);
  };

  const handleCategorySelect = (id: string, presetGoalId?: string) => {
    setSelectedCategory(id);
    const initialGoal = presetGoalId || null;
    setSelectedGoal(initialGoal);
    trackEvent("category_selected", { category: id });
    const cat = categories.find((c: any) => c.id === id);
    const gl = goals.find((g: any) => g.id === initialGoal);
    setTitle(gl ? `${gl.label}: ${cat?.label.toLowerCase()}` : "");
    setDynamicFields({});
    setNotes("");
    setActiveStep(initialGoal ? 3 : 2);
  };

  const currentCategoryObj = categories.find((c: any) => c.id === selectedCategory);
  const currentGoalObj = goals.find((g: any) => g.id === selectedGoal);
  
  const formFields: any[] = Array.from(
    new Map<string, any>(
      [...(currentCategoryObj?.fields || []), ...(currentGoalObj?.fields || [])]
        .map((field: any) => [field.id, field])
    ).values()
  );

  const handleSaveTask = () => {
    if (!selectedCategory || !selectedGoal) {
      toast.error("Choose a category and goal.");
      return;
    }
    const missingRequired = formFields.find(f => f.required && !dynamicFields[f.id]);
    if (missingRequired) {
      toast.error(`Please fill in: ${missingRequired.label}`);
      return;
    }

    const effectiveTitle = title.trim() || `${currentGoalObj?.label || "Check my bill"}: ${currentCategoryObj?.label || "Household payment"}`;
    const payload = {
      title: effectiveTitle,
      category: currentCategoryObj?.label || "Other",
      goal_id: selectedGoal,
      category_id: selectedCategory,
      priority,
      details: dynamicFields,
      notes,
      user_id: buyerId
    };

    if (editingId) {
      updateTask.mutate({ id: editingId, ...payload }, {
        onSuccess: () => {
          toast.success("Task details updated");
          setEditingId(null);
          setActiveStep(4);
        }
      });
    } else {
      createTask.mutate(payload, {
        onSuccess: () => {
          toast.success("Task saved. Review it, then generate your plan.");
          setTitle("");
          setNotes("");
          setDynamicFields({});
          setSelectedCategory(null);
          trackEvent("task_saved", { category: payload.category });
          setActiveStep(4);
        }
      });
    }
  };


  const handleOpenSavedPlan = (note: any) => {
    if (!note?.sections) return;
    setPlanResult(note.sections);
    setProviderEmail(note.provider_email || null);
    setLastKnownDetails(note.known_details || []);
    setLastMissingDetails(note.missing_details || []);
    setSelectedTaskId(note.task_id || null);
    setActiveTab("next_steps");
    setActiveStep(6);
    document.getElementById("output-panel")?.scrollIntoView({ behavior: "smooth" });
    trackEvent("saved_plan_opened");
  };

  const handleEditTask = (t: any) => {
    setEditingId(t.id);
    setSelectedCategory(t.category_id);
    setSelectedGoal(t.goal_id);
    setTitle(t.title);
    setPriority(t.priority || "Medium");
    setNotes(t.notes || "");
    setDynamicFields(t.details || {});
    setActiveStep(3);
    document.getElementById("command-panel")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteTask = (t: any) => {
    if (confirm("Are you sure you want to remove this task?")) {
      deleteTask.mutate({ id: t.id, user_id: buyerId }, {
        onSuccess: () => {
          toast.success("Task removed");
          if (selectedTaskId === t.id) {
            setSelectedTaskId(null);
            setPlanResult(null);
          }
        }
      });
    }
  };

  const handleMarkDone = (t: any) => {
    updateTask.mutate({ id: t.id, status: "Done", user_id: buyerId }, {
      onSuccess: () => toast.success("Task marked as done")
    });
  };

  const findGaps = (task: any) => {
    const gaps: string[] = [];
    const catObj = categories.find((c: any) => c.id === task.category_id);
    const glObj = goals.find((g: any) => g.id === task.goal_id);
    const fields = [...(catObj?.fields || []), ...(glObj?.fields || [])];
    
    fields.forEach((f: any) => {
      if ((f.required || f.recommended) && !task.details?.[f.id]) gaps.push(f.label);
    });
    
    return Array.from(new Set(gaps));
  };

  const handleGenerate = (task: any) => {
    setSelectedTaskId(task.id);
    const gaps = findGaps(task);
    if (gaps.length > 0) {
      setDetectedGaps(gaps);
      setPendingGenerationTask(task);
      setGapModalOpen(true);
      setActiveStep(4);
      return;
    }
    executeGeneration(task);
  };

  const [lastKnownDetails, setLastKnownDetails] = useState<Record<string, unknown> | string[]>([]);
  const [lastMissingDetails, setLastMissingDetails] = useState<string[]>([]);

  const executeGeneration = (task: any) => {
    setGapModalOpen(false);
    setActiveStep(5);
    
    generatePlan.mutate({ task, mode: "full", user_id: buyerId }, {
      onSuccess: (data) => {
        setPlanResult(data.note.sections);
        setProviderEmail(data.note.provider_email);
        setLastKnownDetails(data.note.known_details || []);
        setLastMissingDetails(data.note.missing_details || []);
        toast.success("Plan generated successfully");
        trackEvent("plan_generated", { category: task.category });
        setActiveStep(5);
        document.getElementById("output-panel")?.scrollIntoView({ behavior: "smooth" });
      },
      onError: (err) => {
        toast.error(`Generation failed: ${err.message}`);
      }
    });
  };

  const handleEditGaps = () => {
    setGapModalOpen(false);
    if (pendingGenerationTask) {
      handleEditTask(pendingGenerationTask);
    }
  };

  const handleAiHandoff = () => {
    const task = tasks.find((t: any) => t.id === selectedTaskId);
    if (!task || !planResult) return;
    
    const prompt = `I need help with a household admin task.
Task: ${task.title}
Service: ${task.category}
Goal: ${goals.find((g: any) => g.id === task.goal_id)?.label || 'Resolve issue'}

Known Details:
${formatDetailList(lastKnownDetails)}

Missing Details:
${lastMissingDetails.length > 0 ? lastMissingDetails.join('\n') : 'None'}

The current plan suggested:
Next steps:
${planResult.next_steps || 'None'}

Provider message:
${planResult.provider_message || 'None'}

Things to check:
${planResult.things_to_check || 'None'}

Approval checklist:
${planResult.approval_checklist || 'None'}

Do not make the final decision for me. Tell me what I should consider next.`;

    setAiPrompt(prompt);
    setAiHandoffMode("review");
    setAiHandoffOpen(true);
    trackEvent("ai_handoff_opened");
    setActiveStep(6);
  };
  const handleCompareWithAi = () => {
    const task = tasks.find((t: any) => t.id === selectedTaskId);
    if (!task || !planResult) return;

    const prompt = `I want to reduce the cost of a household bill or subscription without losing important features.

My priority:
${String((lastKnownDetails as Record<string, unknown>)?.deal_priority || (lastKnownDetails as Record<string, unknown>)?.renewal_priority || (lastKnownDetails as Record<string, unknown>)?.desired_outcome || "Get a better deal / lower price")}

Would I switch provider?
${String((lastKnownDetails as Record<string, unknown>)?.switch_willingness || "Not sure")}

Current task:
${task.title}

Category:
${task.category}

Goal:
${goals.find((g: any) => g.id === task.goal_id)?.label || "Compare alternatives"}

Known details:
${formatDetailList(lastKnownDetails)}

Missing details:
${lastMissingDetails.length > 0 ? lastMissingDetails.join('\n') : "None"}

LifeAdmin plan:
${planResult.next_steps || "None"}

Please use current web information where available. I want a practical comparison I can use to negotiate or switch.

1. Find at least five realistic alternatives where enough current information is available.
2. Include current price, introductory period, standard price after the offer, contract length, setup fees, annual price-rise terms, important features and total minimum-term cost.
3. Link to the official provider page or another reliable source for every option.
4. Show which option is closest to my existing service and which offers the lowest total cost.
5. Flag anything that depends on postcode/address availability or eligibility.
6. Separate confirmed facts from anything still needing verification.
7. Suggest the three strongest negotiation points I can take back to my current provider.
8. Give me a short provider-ready negotiation message based on the best evidence.
9. Do not make the final decision for me. Present the options clearly so I can choose.`;

    setAiPrompt(prompt);
    setAiHandoffMode("compare");
    setAiHandoffOpen(true);
    trackEvent("ai_comparison_opened");
    setActiveStep(6);
  };


  const copyToClipboard = async (text: string, eventName: string) => {
    if (!text?.trim()) {
      toast.error("There is nothing to copy in this section yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
      trackEvent(eventName);
      setActiveStep(6);
    } catch {
      toast.error("Copy did not work. Select the text manually and copy it from your device.");
    }
  };

  const openEmailDraft = () => {
    if (providerEmail?.subject && providerEmail?.body) {
      const mailto = `mailto:?subject=${encodeURIComponent(providerEmail.subject)}&body=${encodeURIComponent(providerEmail.body)}`;
      window.location.href = mailto;
      trackEvent("email_opened");
      setActiveStep(6);
    }
  };
  const openAiAssistant = async (url: string, name: string) => {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      toast.success(`Comparison prompt copied. Paste it into ${name}.`);
      trackEvent("ai_prompt_copied");
    } catch {
      toast.info(`Open ${name}, then copy the prompt from this window.`);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };


  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabIds = ["next_steps", "provider_message", "things_to_check", "approval_checklist"];
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabIds.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabIds.length) % tabIds.length;
    }
    if (nextIndex !== index) {
      setActiveTab(tabIds[nextIndex]);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <section id="app" className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-[400px_1fr] gap-8">
      <div id="command-panel" className="space-y-6">
        
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-bold text-primary tracking-wider uppercase mb-1">Start here</p>
            <h2 className="text-2xl font-extrabold text-slate-900">Choose your bill or payment</h2>
          </div>
          
          <div className="space-y-6">
            {!selectedCategory ? (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-800">1. What are you managing?</label>
                
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="E.g. Renew car insurance"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-11 pr-4 py-3 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <button type="submit" disabled={suggestMatch.isPending} className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                    {suggestMatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Match"}
                  </button>
                </form>

                {suggestedMatch && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm uppercase tracking-wider">
                      <Zap className="w-4 h-4" /> Suggested Match
                    </div>
                    <p className="text-slate-800 font-bold mb-1">
                      {categories.find((c: any) => c.id === suggestedMatch.category_id)?.label}
                    </p>
                    <p className="text-slate-600 text-sm mb-1">
                      Suggested goal: {goals.find((g: any) => g.id === suggestedMatch.goal_id)?.label || "Choose a goal next"}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      {suggestedMatch.confidence >= 0.75 ? "Strong match" : suggestedMatch.confidence >= 0.45 ? "Likely match" : "Best available match - review before continuing"}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={acceptSuggestion} className="flex-1 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors">
                        Use this match
                      </button>
                      <button onClick={() => setSuggestedMatch(null)} className="py-2 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {popular.length > 0 && !suggestedMatch && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Popular choices</label>
                    <div className="grid grid-cols-2 gap-2">
                      {popular.map((p: any) => (
                        <button 
                          key={p.id}
                          onClick={() => handleCategorySelect(p.category_id, p.goal_id)}
                          className="text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-primary hover:bg-blue-50 transition-colors group text-sm"
                        >
                          <strong className="block text-slate-800 group-hover:text-primary leading-tight">{p.label}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Collapsible.Root open={isBrowseAllOpen} onOpenChange={setIsBrowseAllOpen}>
                  <Collapsible.Trigger className="flex items-center justify-between w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors mt-2">
                    Browse all categories <ChevronDown className={`w-4 h-4 transition-transform ${isBrowseAllOpen ? 'rotate-180' : ''}`} />
                  </Collapsible.Trigger>
                  <Collapsible.Content className="pt-3 space-y-2">
                    {catalogLoading ? (
                      <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>
                    ) : (
                      categories.map((c: any) => (
                        <button 
                          key={c.id}
                          onClick={() => handleCategorySelect(c.id)}
                          className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-primary hover:bg-blue-50 transition-colors group"
                        >
                          <strong className="block text-slate-800 group-hover:text-primary">{c.label}</strong>
                          <span className="text-xs text-slate-500 mt-1 block">{c.examples}</span>
                        </button>
                      ))
                    )}
                  </Collapsible.Content>
                </Collapsible.Root>

              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center animate-in fade-in zoom-in-95">
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Selected Category</span>
                  <strong className="text-emerald-900">{categories.find((c: any) => c.id === selectedCategory)?.label}</strong>
                </div>
                <button onClick={() => {
                  setSelectedCategory(null);
                  setSelectedGoal(null);
                  setEditingId(null);
                  setTitle("");
                  setDynamicFields({});
                  setNotes("");
                  setActiveStep(1);
                }} className="min-h-[44px] text-sm font-semibold text-emerald-700 hover:text-emerald-900 px-3 py-1.5 bg-white rounded-lg border border-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  Change
                </button>
              </div>
            )}

            {selectedCategory && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">2. What do you want to do?</label>
                  <select 
                    value={selectedGoal || ""}
                    onChange={e => {
                      const nextGoal = e.target.value || null;
                      setSelectedGoal(nextGoal);
                      if (nextGoal) {
                        const goal = goals.find((g: any) => g.id === nextGoal);
                        const category = categories.find((c: any) => c.id === selectedCategory);
                        setTitle(`${goal?.label || "Task"}: ${category?.label?.toLowerCase() || "household payment"}`);
                        setActiveStep(3);
                        trackEvent("goal_selected", { goal: nextGoal });
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Choose a goal...</option>
                    {goals.map((g: any) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                  {currentGoalObj?.description && (
                    <p className="text-sm text-slate-500 mt-2">{currentGoalObj.description}</p>
                  )}
                </div>

                {selectedGoal && <Collapsible.Root>
                  <Collapsible.Trigger className="flex items-center justify-between w-full text-sm font-bold text-slate-600 py-2 hover:text-slate-900 transition-colors">
                    Change task name (optional) <ChevronDown className="w-4 h-4" />
                  </Collapsible.Trigger>
                  <Collapsible.Content className="pt-2">
                    <input 
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Task name"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </Collapsible.Content>
                </Collapsible.Root>}

                {selectedGoal && <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">3. Add what you know</h3>
                    <p className="text-xs text-slate-500 mt-1">Leave anything blank if you are not sure. We will show useful missing details before generating your plan.</p>
                  </div>
                  {formFields.map((f: any) => (
                    <div key={f.id}>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </label>
                      {f.type === 'select' ? (
                        <select
                          value={dynamicFields[f.id] || ""}
                          onChange={e => setDynamicFields(prev => ({...prev, [f.id]: e.target.value}))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="">Select...</option>
                          {f.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea
                          value={dynamicFields[f.id] || ""}
                          onChange={e => setDynamicFields(prev => ({...prev, [f.id]: e.target.value}))}
                          placeholder={f.placeholder || f.label}
                          rows={3}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                        />
                      ) : (
                        <input
                          type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                          value={dynamicFields[f.id] || ""}
                          onChange={e => setDynamicFields(prev => ({...prev, [f.id]: e.target.value}))}
                          placeholder={f.placeholder || f.label}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      )}
                      {f.recommended && !f.required && <p className="text-[11px] text-slate-400 mt-1">Useful if you know it</p>}
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Additional notes (optional)</label>
                    <textarea 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Anything else?"
                      rows={2}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                    Do not enter passwords, full card numbers, security codes or unnecessary account details.
                  </div>
                </div>}

                {selectedGoal && <button 
                  onClick={handleSaveTask}
                  disabled={createTask.isPending || updateTask.isPending}
                  className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3.5 font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {(createTask.isPending || updateTask.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Update task" : "Review details"}
                </button>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 flex flex-col min-w-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="status" aria-label="Workflow progress">
          {["Choose bill", "Choose goal", "Add details", "Review details", "Generate plan", "Use plan"].map((step, i) => {
            const num = i + 1;
            const isActive = activeStep === num;
            const isPast = activeStep > num;
            return (
              <div key={step} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                isActive ? 'bg-primary border-primary text-white shadow-md' : 
                isPast ? 'bg-blue-50 border-blue-200 text-primary' : 
                'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                {num}. {step}
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-sm font-bold text-primary tracking-wider uppercase mb-1">Your work</p>
              <h2 className="text-2xl font-extrabold text-slate-900">Household tasks</h2>
            </div>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2" aria-live="polite">
            {tasksLoading ? (
              <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-slate-500 font-semibold mb-1">No tasks found</p>
                <p className="text-sm text-slate-400">Create a task from the command centre to get started.</p>
              </div>
            ) : (
              tasks.map((t: any) => (
                <div key={t.id} className={`p-4 rounded-xl border transition-all ${selectedTaskId === t.id ? 'border-primary ring-1 ring-primary/20 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold text-lg ${t.status === 'Done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{t.title}</h3>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold whitespace-nowrap">{t.category}</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${t.priority === 'High' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{t.priority}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={() => handleGenerate(t)} className="min-h-[44px] px-4 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors">
                      Generate plan
                    </button>
                    <button onClick={() => handleEditTask(t)} className="min-h-[44px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">
                      Edit
                    </button>
                    {t.status !== 'Done' && (
                      <button onClick={() => handleMarkDone(t)} className="min-h-[40px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">
                        Mark done
                      </button>
                    )}
                    <button onClick={() => handleDeleteTask(t)} aria-label={`Delete ${t.title}`} className="min-h-[44px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-bold transition-colors ml-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" aria-labelledby="saved-plans-heading">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-bold text-primary tracking-wider uppercase mb-1">Saved results</p>
              <h2 id="saved-plans-heading" className="text-xl font-extrabold text-slate-900">Recent plans</h2>
            </div>
            {savedPlans.length > 0 && <span className="text-xs font-bold text-slate-400">{savedPlans.length} saved</span>}
          </div>
          {notesLoading ? (
            <div className="py-6 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : savedPlans.length === 0 ? (
            <p className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">Plans you generate will appear here so you can reopen them without starting again.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {savedPlans.slice(0, 8).map((note: any) => (
                <button
                  key={note.id}
                  onClick={() => handleOpenSavedPlan(note)}
                  className="w-full min-h-[54px] text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-primary hover:bg-blue-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <strong className="block text-sm text-slate-800">{note.title || "Saved plan"}</strong>
                  <span className="block text-xs text-slate-500 mt-1">{formatSavedTime(note.created_at)} · {note.source === "openai" ? "AI-assisted" : "Guided plan"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div id="output-panel" className="bg-[#0f172a] rounded-2xl p-6 shadow-xl text-slate-200 flex flex-col flex-1 min-h-[500px]" aria-live="polite">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
            <div>
              <p className="text-sm font-bold text-blue-400 tracking-wider uppercase mb-1">Your result</p>
              <h2 className="text-2xl font-extrabold text-white">Plan and next action</h2>
            </div>
            {planResult && (
              <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                <button 
                  onClick={() => copyToClipboard(
                    activeTab === "provider_message" && providerEmail?.body ? providerEmail.body : (planResult[activeTab] || ""),
                    activeTab === "provider_message" ? "provider_message_copied" : "section_copied"
                  )} 
                  className="min-h-[44px] flex-1 xl:flex-none px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors shadow-lg flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {activeTab === "provider_message" && providerEmail?.kind === "bank_query"
                    ? "Copy bank query message"
                    : `Copy ${activeTab.replace(/_/g, " ")}`}
                </button>
                {(tasks.find((t: any) => t.id === selectedTaskId)?.category_id === "tv_broadband_mobile" ||
                  tasks.find((t: any) => t.id === selectedTaskId)?.goal_id === "reduce_price" ||
                  tasks.find((t: any) => t.id === selectedTaskId)?.goal_id === "prepare_renewal") && (
                  <button
                    onClick={handleCompareWithAi}
                    className="min-h-[44px] flex-1 xl:flex-none px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl text-sm font-extrabold transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Bot className="w-4 h-4" />
                    Compare alternatives with AI
                  </button>
                )}
                
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button aria-label="More result actions" className="min-h-[44px] px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="min-w-[220px] bg-white rounded-xl p-2 shadow-2xl z-50 border border-slate-200 animate-in fade-in zoom-in-95" align="end" sideOffset={8}>
                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2.5 outline-none rounded-lg cursor-pointer hover:bg-slate-100 text-slate-700 font-semibold text-sm" onSelect={() => {
                        const fullPlan = `${planResult.next_steps}\n\n${planResult.provider_message}\n\n${planResult.things_to_check}\n\n${planResult.approval_checklist}`;
                        copyToClipboard(fullPlan, "section_copied");
                      }}>
                        <Copy className="w-4 h-4" /> Copy full plan
                      </DropdownMenu.Item>
                      {providerEmail?.subject && providerEmail?.body && (
                        <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2.5 outline-none rounded-lg cursor-pointer hover:bg-slate-100 text-slate-700 font-semibold text-sm" onSelect={openEmailDraft}>
                          <Mail className="w-4 h-4" /> {providerEmail?.kind === "bank_query" ? "Open bank query draft" : "Open email draft"}
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2.5 outline-none rounded-lg cursor-pointer hover:bg-slate-100 text-slate-700 font-semibold text-sm" onSelect={() => copyToClipboard(planResult.things_to_check, "section_copied")}>
                        <Copy className="w-4 h-4" /> Copy things to check
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />
                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2.5 outline-none rounded-lg cursor-pointer hover:bg-blue-50 text-primary font-semibold text-sm" onSelect={handleAiHandoff}>
                        <Bot className="w-4 h-4" /> Continue with AI
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            )}
          </div>

          {planResult && (() => {
            const currentTask = tasks.find((t: any) => t.id === selectedTaskId);
            const alternatives = potentialAlternatives(currentTask);
            if (!alternatives.length) return null;
            return (
              <div className="mb-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-cyan-300 mb-1">Potential alternatives</p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {alternatives.join(" · ")}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">Examples to investigate, not live price quotes. Use AI research to check current offers and official source links.</p>
                  </div>
                  <button
                    onClick={handleCompareWithAi}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-300 hover:bg-cyan-200 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shrink-0"
                  >
                    <Bot className="w-4 h-4" />
                    Find current alternatives with AI
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="flex-1 bg-[#1e293b] border border-slate-700 rounded-xl p-6">
            {generatePlan.isPending ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[250px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="font-semibold">Generating your custom admin plan...</p>
              </div>
            ) : !planResult ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-medium text-center min-h-[250px]">
                Select a task and press Generate plan.
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex gap-2 border-b border-slate-700 pb-3 mb-4 overflow-x-auto scrollbar-hide" role="tablist">
                  {tabIds.map((id, idx) => (
                    <button
                      key={id}
                      ref={el => { tabRefs.current[idx] = el; }}
                      role="tab"
                      id={`tab-${id}`}
                      aria-controls={`panel-${id}`}
                      aria-selected={activeTab === id}
                      tabIndex={activeTab === id ? 0 : -1}
                      onClick={() => setActiveTab(id)}
                      onKeyDown={(e) => handleTabKeyDown(e, idx)}
                      className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${activeTab === id ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                    >
                      {id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
                
                <div id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="prose prose-invert prose-blue max-w-none text-slate-300" role="tabpanel" tabIndex={0}>
                  <p className="not-prose text-xs font-semibold text-slate-400 mb-4">{sectionHelperText(activeTab)}</p>
                  {planResult[activeTab]?.trim() ? (
                    <div dangerouslySetInnerHTML={{ __html: formatResultText(planResult[activeTab]) }} />
                  ) : (
                    <p className="not-prose text-sm text-slate-400">{activeTab === "provider_message" ? "Provider message not ready. Add who you want to contact and what you want to ask, then generate again." : "No additional content is needed for this section."}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {gapModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onKeyDown={e => e.key === 'Escape' && setGapModalOpen(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="gapTitle">
            <h3 id="gapTitle" className="text-xl font-extrabold text-slate-900 mb-2">Missing key details</h3>
            <p className="text-slate-600 mb-4">Your task is missing some details that help the AI generate a precise plan. You can proceed without them, but the output may be less specific.</p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <ul className="space-y-2">
                {detectedGaps.map(g => (
                  <li key={g} className="flex gap-2 text-amber-900 font-semibold text-sm">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" /> {g}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex justify-end gap-3">
              <button onClick={handleEditGaps} className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Edit task
              </button>
              <button onClick={() => executeGeneration(pendingGenerationTask)} className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold bg-primary hover:bg-blue-600 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {aiHandoffOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onKeyDown={e => e.key === 'Escape' && setAiHandoffOpen(false)}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="aiHandoffTitle">
            <h3 id="aiHandoffTitle" className="text-xl font-extrabold text-slate-900 mb-2">{aiHandoffMode === "compare" ? "Find current alternatives with AI" : "Continue with an AI assistant"}</h3>
            
            <div className="bg-orange-50 border border-orange-200 text-orange-900 p-3 rounded-xl text-sm font-medium mb-4">
              <strong>Check before copying:</strong> remove account numbers, payment-card details, passwords and any sensitive information you do not want to share.
            </div>
            
            <p className="text-slate-600 text-sm mb-4">
              {aiHandoffMode === "compare"
                ? "This prompt asks a web-enabled AI assistant to research current alternatives, prices and source links. Nothing is sent automatically."
                : "The text below is not sent anywhere automatically. Review it, then choose how you want to copy it or open an assistant separately."}
            </p>

            {aiHandoffMode === "compare" && (
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <strong className="block text-slate-900 text-sm">3+ alternatives</strong>
                  <span className="text-xs text-slate-500">Like-for-like options</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <strong className="block text-slate-900 text-sm">Current prices</strong>
                  <span className="text-xs text-slate-500">Terms and total cost</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <strong className="block text-slate-900 text-sm">Source links</strong>
                  <span className="text-xs text-slate-500">Official pages where possible</span>
                </div>
              </div>
            )}

            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="ai-prompt-preview" className="text-sm font-extrabold text-slate-900">Prompt preview</label>
              <span className="text-xs text-slate-500">Edit before sharing if needed</span>
            </div>
            <textarea
              id="ai-prompt-preview"
              ref={aiPromptRef}
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              aria-label="Structured AI Prompt"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-700 h-56 mb-5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Recommended free options</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => openAiAssistant("https://gemini.google.com/", "Google Gemini")} className="min-h-[48px] px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-extrabold text-white text-center flex items-center justify-center gap-2">Copy & open Gemini <ExternalLink className="w-4 h-4" /></button>
                <button onClick={() => openAiAssistant("https://copilot.microsoft.com/", "Microsoft Copilot")} className="min-h-[48px] px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm font-extrabold text-white text-center flex items-center justify-center gap-2">Copy & open Copilot <ExternalLink className="w-4 h-4" /></button>
              </div>
            </div>

            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Other popular AI assistants</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <button onClick={() => openAiAssistant("https://chatgpt.com/", "ChatGPT")} className="min-h-[44px] px-3 py-2 bg-[#10a37f] hover:bg-[#0e906f] rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2">ChatGPT <ExternalLink className="w-4 h-4" /></button>
              <button onClick={() => openAiAssistant("https://claude.ai/new", "Claude")} className="min-h-[44px] px-3 py-2 bg-[#d97757] hover:bg-[#c4684a] rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2">Claude <ExternalLink className="w-4 h-4" /></button>
              <button onClick={() => openAiAssistant("https://www.perplexity.ai/", "Perplexity")} className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-800 flex items-center justify-center gap-2">Perplexity <ExternalLink className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => copyToClipboard(aiPrompt, "ai_prompt_copied")} className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-700">Copy prompt only</button>
              <button onClick={() => setAiHandoffOpen(false)} className="min-h-[44px] px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-700">Close</button>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}

function potentialAlternatives(task: any): string[] {
  if (!task) return [];
  const category = task.category_id;
  if (category === "tv_broadband_mobile") {
    return ["Virgin Media", "BT / EE", "NOW", "Full-fibre broadband + separate streaming"];
  }
  if (category === "energy_water") {
    return ["Current supplier retention tariff", "Alternative fixed tariff", "Flexible / standard tariff", "Accredited comparison-market options"];
  }
  if (category === "insurance") {
    return ["Current insurer retention quote", "Comparison-market quote", "Direct-only insurer", "Higher-excess / adjusted-cover option"];
  }
  if (category === "subscriptions_memberships") {
    return ["Cheaper plan tier", "Annual billing", "Bundle through another service", "Cancel and replace with a lower-cost alternative"];
  }
  if (category === "home_security_maintenance") {
    return ["Provider renewal offer", "Independent local service", "Pay-as-you-go alternative", "Equivalent cover from another provider"];
  }
  return [];
}

function sectionHelperText(section: string) {
  const helpers: Record<string, string> = {
    next_steps: "Start here. These are the practical actions to take next.",
    provider_message: "A message you can review, edit and send to the provider.",
    things_to_check: "Important checks before you cancel, switch, dispute or send a message.",
    approval_checklist: "Use this before copying, emailing or acting on the plan.",
  };
  return helpers[section] || "Review this section before acting.";
}

function formatResultText(text: string) {
  if (!text?.trim()) return "<p>No data available for this section.</p>";

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const inline = (value: string) =>
    escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    blocks.push(
      `<${listType} class="my-3 space-y-2 pl-5 ${listType === "ul" ? "list-disc" : "list-decimal"}">${listItems
        .map(item => `<li>${item}</li>`)
        .join("")}</${listType}>`
    );
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls = level === 1
        ? "text-xl font-extrabold text-white mt-5 mb-2"
        : level === 2
          ? "text-base font-bold text-white mt-4 mb-2"
          : "text-sm font-bold text-slate-100 mt-3 mb-1";
      blocks.push(`<h${level} class="${cls}">${inline(heading[2])}</h${level}>`);
      continue;
    }

    const checklist = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checklist) {
      flushList();
      const checked = checklist[1].toLowerCase() === "x";
      blocks.push(
        `<div class="my-2 flex items-start gap-2"><span aria-hidden="true" class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-500 text-xs">${checked ? "✓" : ""}</span><span>${inline(checklist[2])}</span></div>`
      );
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(inline(bullet[1]));
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(inline(numbered[1]));
      continue;
    }

    flushList();
    blocks.push(`<p class="my-2 leading-7">${inline(line)}</p>`);
  }

  flushList();
  return blocks.join("");
}

function formatDetailList(details: Record<string, unknown> | string[]) {
  if (Array.isArray(details)) {
    return details.length > 0 ? details.join("\n") : "None";
  }
  const entries = Object.entries(details || {}).filter(([, value]) => value !== null && value !== "");
  return entries.length > 0
    ? entries.map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`).join("\n")
    : "None";
}

function formatSavedTime(value?: string) {
  if (!value) return "Saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
