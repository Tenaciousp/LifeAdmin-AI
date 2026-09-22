"""Canonical, server-owned LifeAdmin product domain.

The frontend renders this catalogue, but routing, field recommendations and task
normalisation stay server-owned so web and future native clients behave the same.
"""
from __future__ import annotations

import re
from typing import Any


_BASE_FIELDS = [
    {"id": "provider", "label": "Provider or organisation", "type": "text", "required": False, "placeholder": "e.g. Sky, Aviva or your local council"},
    {"id": "payment_description", "label": "Payment or bill description", "type": "text", "required": False, "placeholder": "What appears on your statement or bill?"},
    {"id": "amount", "label": "Amount", "type": "text", "required": False, "placeholder": "e.g. £42.99 per month"},
    {"id": "date", "label": "Relevant date", "type": "date", "required": False, "placeholder": "Renewal, payment or deadline date"},
    {"id": "what_happened", "label": "What happened?", "type": "textarea", "required": False, "placeholder": "Tell us what changed or what you need help with"},
    {"id": "desired_outcome", "label": "What would you like to happen?", "type": "textarea", "required": False, "placeholder": "e.g. a lower price, clarification or cancellation"},
]

_SPECIAL_FIELDS = {
    "tv_broadband_mobile": [
        {"id": "billing_route", "label": "Where is it billed?", "type": "select", "required": False, "options": ["Direct with provider", "Apple", "Google Play", "Amazon", "Other"]},
        {"id": "contract_end_date", "label": "Contract end date", "type": "date", "required": False, "placeholder": "When does the minimum term end?"},
        {"id": "package", "label": "Package or plan", "type": "text", "required": False, "placeholder": "e.g. broadband 150 Mbps, SIM-only, TV + sports"},
    ],
    "energy_water": [
        {"id": "tariff", "label": "Tariff or plan", "type": "text", "required": False, "placeholder": "e.g. fixed, variable or dual fuel"},
        {"id": "meter_reading", "label": "Latest meter reading", "type": "text", "required": False, "placeholder": "Optional"},
        {"id": "annual_usage", "label": "Annual usage", "type": "text", "required": False, "placeholder": "Optional kWh from a recent bill"},
    ],
    "insurance": [
        {"id": "policy_type", "label": "Policy type", "type": "select", "required": False, "options": ["Car", "Home", "Contents", "Pet", "Travel", "Life", "Health", "Other"]},
        {"id": "new_quote", "label": "New quote", "type": "text", "required": False, "placeholder": "Optional comparison quote"},
        {"id": "auto_renewal", "label": "Auto-renewal", "type": "select", "required": False, "options": ["Yes", "No", "Not sure"]},
    ],
    "council_tax_licences": [
        {"id": "property_band", "label": "Property band or licence type", "type": "text", "required": False, "placeholder": "e.g. Band C or TV licence"},
        {"id": "household_status", "label": "Household status", "type": "text", "required": False, "placeholder": "Useful for discounts or exemptions"},
    ],
    "subscriptions_memberships": [
        {"id": "billing_route", "label": "Where is it billed?", "type": "select", "required": False, "options": ["Direct with provider", "Apple", "Google Play", "Amazon", "PayPal", "TV/broadband bundle", "Other"]},
        {"id": "next_payment_date", "label": "Next payment date", "type": "date", "required": False, "placeholder": "Optional"},
        {"id": "minimum_term_end", "label": "Minimum term ends", "type": "date", "required": False, "placeholder": "Leave blank if there is no minimum term"},
    ],
    "rent_mortgage_property": [
        {"id": "account_reference", "label": "Account or tenancy reference", "type": "text", "required": False, "placeholder": "Optional reference"},
        {"id": "property_address", "label": "Property area", "type": "text", "required": False, "placeholder": "Avoid a full address unless needed"},
        {"id": "agreement_type", "label": "Agreement type", "type": "text", "required": False, "placeholder": "e.g. tenancy, fixed mortgage, service charge"},
    ],
    "credit_loans_finance": [
        {"id": "finance_type", "label": "Finance type", "type": "select", "required": False, "options": ["Credit card", "Personal loan", "Car finance", "Store card", "Overdraft", "Buy now pay later", "Other"]},
        {"id": "interest_rate", "label": "Interest rate", "type": "text", "required": False, "placeholder": "Optional"},
        {"id": "transaction_status", "label": "Transaction status", "type": "select", "required": False, "options": ["Pending", "Posted", "Not sure"]},
    ],
    "transport_vehicle": [
        {"id": "vehicle_or_booking", "label": "Vehicle or service type", "type": "text", "required": False, "placeholder": "e.g. car tax, parking permit, rail pass or EV charging"},
        {"id": "reference", "label": "Booking or registration reference", "type": "text", "required": False, "placeholder": "Optional"},
    ],
    "health_care_pets": [
        {"id": "service_type", "label": "Service type", "type": "text", "required": False, "placeholder": "e.g. dental plan, prescription, vet plan or pet insurance"},
        {"id": "appointment_date", "label": "Appointment or treatment date", "type": "date", "required": False, "placeholder": "Optional"},
    ],
    "family_childcare_education": [
        {"id": "family_service", "label": "Service type", "type": "text", "required": False, "placeholder": "e.g. nursery, school club or tuition"},
        {"id": "deadline", "label": "Deadline", "type": "date", "required": False, "placeholder": "Optional"},
    ],
    "home_security_maintenance": [
        {"id": "home_service", "label": "Home service", "type": "text", "required": False, "placeholder": "e.g. boiler cover, alarm, appliance cover or repair"},
        {"id": "contract_end_date", "label": "Contract end date", "type": "date", "required": False, "placeholder": "Optional"},
    ],
    "other_regular_payment": [
        {"id": "statement_description", "label": "Statement description", "type": "text", "required": False, "placeholder": "Copy only the merchant/payment wording, not account numbers"},
        {"id": "payment_method", "label": "Payment method", "type": "select", "required": False, "options": ["Direct debit", "Standing order", "Debit card", "Credit card", "PayPal", "Bank transfer", "Unknown"]},
        {"id": "payment_status", "label": "Payment status", "type": "select", "required": False, "options": ["Pending", "Posted", "Unknown"]},
        {"id": "recurring", "label": "Does it repeat?", "type": "select", "required": False, "options": ["Yes", "No", "Unknown"]},
    ],
}

_GOAL_FIELDS = {
    "identify_payment": [
        {"id": "statement_description", "label": "Statement description", "type": "text", "required": False, "recommended": True, "placeholder": "Merchant/payment wording only"},
        {"id": "amount", "label": "Amount", "type": "text", "required": False, "recommended": True, "placeholder": "e.g. £12.99"},
        {"id": "date", "label": "Payment date", "type": "date", "required": False, "recommended": True, "placeholder": "Date shown on the statement"},
        {"id": "recurring", "label": "Does it repeat?", "type": "select", "required": False, "recommended": True, "options": ["Yes", "No", "Unknown"]},
    ],
    "check_bill": [
        {"id": "amount", "label": "Current amount", "type": "text", "required": False, "recommended": True, "placeholder": "Current bill or payment"},
        {"id": "previous_amount", "label": "Previous amount", "type": "text", "required": False, "recommended": False, "placeholder": "Optional comparison"},
        {"id": "what_happened", "label": "What changed or looks wrong?", "type": "textarea", "required": False, "recommended": True, "placeholder": "Describe the charge, increase or issue"},
    ],
    "prepare_renewal": [
        {"id": "date", "label": "Renewal date", "type": "date", "required": False, "recommended": True, "placeholder": "When does it renew?"},
        {"id": "amount", "label": "Current price", "type": "text", "required": False, "recommended": True, "placeholder": "Current monthly or annual price"},
        {"id": "new_quote", "label": "Renewal quote", "type": "text", "required": False, "recommended": True, "placeholder": "New price if supplied"},
        {"id": "auto_renewal", "label": "Auto-renewal", "type": "select", "required": False, "recommended": False, "options": ["Yes", "No", "Not sure"]},
    ],
    "reduce_price": [
        {"id": "amount", "label": "Current price", "type": "text", "required": False, "recommended": True, "placeholder": "Current monthly or annual price"},
        {"id": "contract_end_date", "label": "Contract end date", "type": "date", "required": False, "recommended": True, "placeholder": "If there is a minimum term"},
        {"id": "must_keep", "label": "What must you keep?", "type": "text", "required": False, "recommended": False, "placeholder": "e.g. sports channels, roaming, specific cover"},
    ],
    "cancel_switch": [
        {"id": "next_payment_date", "label": "Next payment date", "type": "date", "required": False, "recommended": True, "placeholder": "Optional"},
        {"id": "minimum_term_end", "label": "Minimum term ends", "type": "date", "required": False, "recommended": True, "placeholder": "Leave blank if there is no minimum term"},
        {"id": "billing_route", "label": "Billing route", "type": "text", "required": False, "recommended": True, "placeholder": "Direct, Apple, Google Play, Amazon, partner, etc."},
        {"id": "confirmation_received", "label": "Cancellation confirmation already received?", "type": "select", "required": False, "recommended": False, "options": ["Yes", "No", "Not yet requested"]},
    ],
    "challenge_charge": [
        {"id": "amount", "label": "Charge amount", "type": "text", "required": False, "recommended": True, "placeholder": "Amount challenged"},
        {"id": "date", "label": "Charge date", "type": "date", "required": False, "recommended": True, "placeholder": "Date taken or billed"},
        {"id": "what_happened", "label": "Why are you challenging it?", "type": "textarea", "required": False, "recommended": True, "placeholder": "Explain what is wrong or unexpected"},
        {"id": "provider_contacted", "label": "Provider already contacted?", "type": "select", "required": False, "recommended": False, "options": ["Yes", "No"]},
    ],
    "contact_provider": [
        {"id": "provider", "label": "Provider or organisation", "type": "text", "required": False, "recommended": True, "placeholder": "Who do you want to contact?"},
        {"id": "what_happened", "label": "What do you want to ask about?", "type": "textarea", "required": False, "recommended": True, "placeholder": "Briefly explain the issue"},
        {"id": "desired_outcome", "label": "What response do you want?", "type": "textarea", "required": False, "recommended": True, "placeholder": "e.g. explanation, correction, cancellation confirmation"},
    ],
}

_GOAL_DATA = [
    ("identify_payment", "Identify a payment", "Work out what a payment might relate to and what to check next.", ["unknown payment", "unknown recurring payment", "recurring payment", "unrecognised", "unrecognized", "do not recognise", "mystery payment", "merchant i do not know", "what is this payment"]),
    ("check_bill", "Check my bill", "Understand a charge, increase or payment.", ["check bill", "review bill", "understand bill", "payment amount", "invoice", "statement", "bill increase", "direct debit increased"]),
    ("prepare_renewal", "Prepare for renewal", "Get ready before a policy, contract or deal renews.", ["renewal", "renew", "contract ending", "coming up", "expires", "expiry", "deal ending", "tariff ending"]),
    ("reduce_price", "Reduce my price", "Ask for a better deal, discount or cheaper package.", ["cheaper", "save money", "reduce price", "lower bill", "better deal", "negotiate", "too expensive", "price rise", "discount", "haggle"]),
    ("cancel_switch", "Cancel or switch", "Leave, cancel, switch or stop future payments.", ["cancel", "switch", "leave", "stop paying", "change provider", "end membership", "terminate", "stop payments"]),
    ("challenge_charge", "Challenge a charge", "Query a mistake, refund or unexpected payment.", ["challenge", "dispute", "wrong charge", "charged too much", "complaint", "refund", "not received", "overcharged", "unexpected charge", "unauthorised", "unauthorized"]),
    ("contact_provider", "Contact provider", "Create a clear message to send.", ["contact provider", "write to", "message supplier", "ask provider", "query provider", "call provider", "email provider", "letter"]),
]

GOALS = [
    {"id": goal_id, "label": label, "description": description, "synonyms": synonyms, "fields": _GOAL_FIELDS.get(goal_id, [])}
    for goal_id, label, description, synonyms in _GOAL_DATA
]

_CATEGORY_DATA = [
    ("tv_broadband_mobile", "TV, broadband and mobile", True, ["broadband", "wifi", "wi fi", "mobile", "phone", "sky", "virgin media", "bt", "ee", "vodafone", "o2", "three", "talktalk", "plusnet", "now", "smarty", "giffgaff", "voxi", "tesco mobile", "lebara", "id mobile", "tv package", "telecom", "sim", "landline", "roaming"], "Sky broadband price review; mobile contract renewal; TV package cancellation"),
    ("energy_water", "Energy and water", True, ["energy", "gas", "electricity", "water", "utility", "tariff", "dual fuel", "meter", "octopus", "british gas", "e.on", "eon", "edf", "ovo", "scottishpower", "utilita", "united utilities", "thames water", "yorkshire water", "severn trent"], "Energy tariff renewal; check water bill; reduce electricity price"),
    ("insurance", "Insurance", True, ["insurance", "policy", "premium", "insurer", "car insurance", "home insurance", "contents insurance", "pet insurance", "travel insurance", "life insurance", "renewal quote", "admiral", "direct line", "aviva", "axa", "lv", "hastings", "churchill", "esure", "rac", "aa"], "Car insurance renewal; compare home cover; challenge a premium increase"),
    ("council_tax_licences", "Council tax and licences", True, ["council tax", "local authority", "property band", "single person discount", "tv licence", "television licence", "parking permit", "garden waste"], "Check council tax bill; query a discount; check TV licence"),
    ("subscriptions_memberships", "Subscriptions and memberships", True, ["subscription", "membership", "netflix", "spotify", "disney", "disney+", "gym", "streaming", "prime video", "amazon prime", "apple subscription", "google play subscription", "youtube premium", "microsoft 365", "icloud", "google one", "dropbox", "adobe", "canva", "xbox game pass", "playstation plus", "audible", "kindle unlimited", "strava", "duolingo"], "Cancel Netflix; review gym membership; check an Apple subscription"),
    ("rent_mortgage_property", "Rent, mortgage and property", False, ["rent", "mortgage", "service charge", "ground rent", "landlord", "housing", "property payment", "tenancy", "leasehold", "shared ownership", "management fee"], "Prepare for a mortgage renewal; check rent payment; query a service charge"),
    ("credit_loans_finance", "Credit, loans and finance", False, ["credit card", "loan", "minimum payment", "finance", "debt", "interest", "overdraft", "car finance", "pcp", "hire purchase", "store card", "klarna", "paypal credit", "clearpay", "chargeback", "barclaycard", "capital one", "mbna", "amex", "aqua", "vanquis"], "Check a credit-card payment; query interest; challenge a transaction"),
    ("transport_vehicle", "Transport and vehicle costs", False, ["car tax", "vehicle tax", "mot", "car service", "breakdown cover", "parking", "parking permit", "toll", "congestion charge", "clean air zone", "train season ticket", "bus pass", "ev charging", "vehicle", "transport"], "Check car tax; challenge a parking charge; review an EV charging subscription"),
    ("health_care_pets", "Health, care and pets", False, ["dental plan", "optical plan", "prescription", "health cover", "care plan", "mobility", "pet plan", "vet", "pet insurance", "pharmacy", "therapy", "health", "care"], "Check a vet payment; review a dental plan; prepare for pet-cover renewal"),
    ("family_childcare_education", "Family, childcare and education", False, ["nursery", "childcare", "school meals", "school transport", "after school", "tutor", "tuition", "education", "university accommodation", "exam fee", "club membership"], "Check childcare fees; contact a school club; review tuition"),
    ("home_security_maintenance", "Home services, security and maintenance", False, ["boiler service", "boiler cover", "appliance cover", "home security", "alarm", "cctv", "cleaner", "window cleaner", "gardening", "pest control", "storage unit", "repair", "maintenance"], "Renew boiler cover; check a security subscription; query a home service"),
    ("other_regular_payment", "Other regular payment", True, ["unknown payment", "recurring payment", "direct debit", "standing order", "card payment", "bank statement", "do not recognise", "unrecognised", "unrecognized", "mystery payment", "regular payment"], "Identify an unknown recurring payment; check a direct debit; query a card payment"),
]

CATEGORIES = [
    {"id": category_id, "label": label, "popular": popular, "synonyms": synonyms, "examples": examples, "fields": _BASE_FIELDS + _SPECIAL_FIELDS.get(category_id, [])}
    for category_id, label, popular, synonyms, examples in _CATEGORY_DATA
]

_CATEGORY_MAP = {item["id"]: item for item in CATEGORIES}
_GOAL_MAP = {item["id"]: item for item in GOALS}

POPULAR_CHOICES = [
    {"id": "sky_reduce", "label": "Reduce my Sky bill", "category_id": "tv_broadband_mobile", "goal_id": "reduce_price"},
    {"id": "netflix_cancel", "label": "Cancel Netflix", "category_id": "subscriptions_memberships", "goal_id": "cancel_switch"},
    {"id": "mobile_check", "label": "Check my mobile bill", "category_id": "tv_broadband_mobile", "goal_id": "check_bill"},
    {"id": "car_insurance", "label": "Review car insurance", "category_id": "insurance", "goal_id": "prepare_renewal"},
    {"id": "energy_ending", "label": "Energy tariff ending", "category_id": "energy_water", "goal_id": "prepare_renewal"},
    {"id": "council_query", "label": "Council tax query", "category_id": "council_tax_licences", "goal_id": "challenge_charge"},
    {"id": "gym_cancel", "label": "Cancel gym membership", "category_id": "subscriptions_memberships", "goal_id": "cancel_switch"},
    {"id": "unknown_charge", "label": "Identify a card charge", "category_id": "other_regular_payment", "goal_id": "identify_payment"},
]

ANALYTICS_EVENTS = {
    "start_flow": "User opens the task picker",
    "picker_searched": "User searches for a bill or payment",
    "category_selected": "User selects a household category",
    "goal_selected": "User selects a goal",
    "suggestion_accepted": "User accepts a suggested route",
    "task_created": "A task is successfully saved",
    "plan_generated": "A structured plan is successfully generated",
    "provider_message_copied": "A provider message is copied",
    "email_opened": "A prepared email draft is opened",
    "ai_handoff_opened": "The manual AI handoff is opened",
    "ai_prompt_copied": "The AI handoff prompt is copied",
    "account_created": "A user creates an account",
    "checkout_started": "A live checkout is opened",
}


def catalog() -> dict[str, Any]:
    popular_categories = [x for x in CATEGORIES if x["popular"]]
    return {
        "categories": CATEGORIES,
        "goals": GOALS,
        "popular_choices": POPULAR_CHOICES,
        # Kept for older clients while the current web client uses popular_choices.
        "popular": POPULAR_CHOICES,
        "popular_categories": popular_categories,
        "examples": [{"category_id": x["id"], "text": x["examples"]} for x in CATEGORIES],
        "analytics_events": ANALYTICS_EVENTS,
    }


def _normalise(value: Any) -> str:
    return re.sub(r"[^a-z0-9+£$.-]+", " ", str(value or "").lower()).strip()


def suggest(query: str) -> dict[str, Any]:
    text = _normalise(query)
    if not text:
        return {"category_id": None, "goal_id": None, "category": None, "goal": None, "confidence": 0, "reasons": [], "popular_categories": [x["id"] for x in CATEGORIES if x["popular"]]}

    def phrase_matches(phrase: str) -> bool:
        value = _normalise(phrase)
        if not value:
            return False
        # Match complete words/phrases rather than arbitrary substrings. This
        # prevents short provider names such as "EE" matching words like "fees".
        pattern = r"(?<![a-z0-9])" + re.escape(value).replace(r"\ ", r"\s+") + r"(?![a-z0-9])"
        return re.search(pattern, text) is not None

    category_scores: dict[str, int] = {}
    for item in CATEGORIES:
        matches = [syn for syn in item["synonyms"] if phrase_matches(syn)]
        if matches:
            category_scores[item["id"]] = sum(len(_normalise(syn).split()) + 1 for syn in matches)

    goal_scores: dict[str, int] = {}
    for item in GOALS:
        matches = [syn for syn in item["synonyms"] if phrase_matches(syn)]
        if matches:
            goal_scores[item["id"]] = sum(len(_normalise(syn).split()) + 1 for syn in matches)

    # Price language tied to a communications package is normally a request to
    # negotiate or reduce the bill rather than merely inspect it.
    if category_scores.get("tv_broadband_mobile") and any(term in text for term in (" price", "price ", "cost", "expensive")):
        goal_scores["reduce_price"] = max(goal_scores.get("reduce_price", 0), 5)

    if any(term in text for term in ("unknown", "unrecognised", "unrecognized", "mystery", "do not recognise")) and any(
        term in text for term in ("payment", "charge", "card", "direct debit", "bank")
    ):
        goal_scores["identify_payment"] = max(goal_scores.get("identify_payment", 0), 10)
        if not category_scores or max(category_scores.values(), default=0) <= 3:
            category_scores["other_regular_payment"] = 9

    category_id = max(category_scores, key=category_scores.get) if category_scores else None
    goal_id = max(goal_scores, key=goal_scores.get) if goal_scores else None

    if not goal_id:
        if any(term in text for term in ("renewal", "renew", "expires", "expiry", "ending")):
            goal_id = "prepare_renewal"
        elif any(term in text for term in ("cancel", "switch", "leave", "stop paying", "terminate")):
            goal_id = "cancel_switch"
        elif any(term in text for term in ("wrong", "dispute", "challenge", "complaint", "refund", "overcharged")):
            goal_id = "challenge_charge"
        elif any(term in text for term in ("too expensive", "cheaper", "discount", "better deal", "price rise")):
            goal_id = "reduce_price"
        elif any(term in text for term in ("payment", "bill", "fees", "fee", "price", "cost", "charge")):
            goal_id = "check_bill"

    reasons = []
    if category_id:
        reasons.append(f"Matched {_CATEGORY_MAP[category_id]['label'].lower()}.")
    if goal_id:
        reasons.append(f"Matched the goal ‘{_GOAL_MAP[goal_id]['label'].lower()}’." )
    score = category_scores.get(category_id, 0) + goal_scores.get(goal_id, 0)
    confidence = 0 if not (category_id or goal_id) else min(0.98, round(0.38 + 0.07 * score, 2))
    return {
        "category_id": category_id,
        "goal_id": goal_id,
        "category": category_id,
        "goal": goal_id,
        "confidence": confidence,
        "reasons": reasons,
        "popular_categories": [x["id"] for x in CATEGORIES if x["popular"]],
    }


def _dedupe_fields(fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered: dict[str, dict[str, Any]] = {}
    for field in fields:
        field_id = field.get("id")
        if not field_id:
            continue
        if field_id in ordered:
            ordered[field_id] = {**ordered[field_id], **field}
        else:
            ordered[field_id] = dict(field)
    return list(ordered.values())


def fields_for(category_id: str, goal_id: str | None = None) -> list[dict[str, Any]]:
    category = _CATEGORY_MAP.get(category_id) or _CATEGORY_MAP["other_regular_payment"]
    goal = _GOAL_MAP.get(goal_id or "")
    return _dedupe_fields(list(category["fields"]) + (list(goal.get("fields", [])) if goal else []))


def normalise_task(task: dict[str, Any]) -> dict[str, Any]:
    result = dict(task or {})
    details = result.get("details") if isinstance(result.get("details"), dict) else {}
    result["details"] = {str(k)[:80]: str(v)[:500] for k, v in details.items() if v not in (None, "")}
    category = result.get("category_id") or result.get("category") or "other_regular_payment"
    legacy_categories = {
        "TV, broadband or phone": "tv_broadband_mobile",
        "Gas, electricity or water": "energy_water",
        "Council tax": "council_tax_licences",
        "Subscriptions and memberships": "subscriptions_memberships",
        "Other household bill or renewal": "other_regular_payment",
        "Renewal": "other_regular_payment",
        "other_payment": "other_regular_payment",
    }
    category_id = legacy_categories.get(category, category)
    if category_id not in _CATEGORY_MAP:
        category_id = "other_regular_payment"
    goal_id = result.get("goal_id") or ""
    if goal_id not in _GOAL_MAP:
        goal_id = "check_bill"
    result["category_id"] = category_id
    result["goal_id"] = goal_id
    result["category"] = _CATEGORY_MAP[category_id]["label"]
    return result


def auto_title(category_id: str, goal_id: str, provider: str = "") -> str:
    category = _CATEGORY_MAP.get(category_id) or _CATEGORY_MAP["other_regular_payment"]
    goal = _GOAL_MAP.get(goal_id) or _GOAL_MAP["check_bill"]
    provider = str(provider or "").strip()
    if provider:
        return f"{provider}: {goal['label']}"[:160]
    return f"{goal['label']}: {category['label']}"[:160]


def missing_details(task: dict[str, Any]) -> list[str]:
    task = normalise_task(task)
    details = task["details"]
    missing = []
    for field in fields_for(task["category_id"], task.get("goal_id")):
        if (field.get("required") or field.get("recommended")) and not details.get(field["id"]):
            missing.append(field["label"])
    return list(dict.fromkeys(missing))[:6]


def is_unknown_payment(task: dict[str, Any]) -> bool:
    task = normalise_task(task)
    raw = _normalise(f"{task.get('title')} {task.get('notes')} {task.get('details', {}).get('payment_description', '')} {task.get('details', {}).get('statement_description', '')}")
    return task.get("goal_id") == "identify_payment" or (
        task["category_id"] == "other_regular_payment" and any(term in raw for term in ("unknown", "unrecognised", "unrecognized", "mystery", "do not recognise"))
    )


def provider_email_for_sections(sections: dict[str, str], task: dict[str, Any]) -> dict[str, str] | None:
    body = str(sections.get("provider_message") or "").strip()
    if not body or is_unknown_payment(task):
        return None
    canonical = normalise_task(task)
    provider = str(canonical.get("details", {}).get("provider") or "Provider").strip()
    goal_id = canonical.get("goal_id") or "check_bill"
    subjects = {
        "prepare_renewal": f"{provider} renewal review",
        "reduce_price": f"Review of my {provider} price",
        "cancel_switch": f"Cancellation or switching confirmation - {provider}",
        "challenge_charge": f"Query about a charge - {provider}",
        "contact_provider": f"Account query - {provider}",
        "check_bill": f"Bill query - {provider}",
    }
    subject = subjects.get(goal_id) or f"{provider} account query"
    return {
        "subject": subject[:140],
        "body": re.sub(r"^##\s+[^\n]+\n?", "", body).strip(),
        "kind": "provider",
    }


def unknown_payment_sections(task: dict[str, Any]) -> dict[str, Any]:
    details = normalise_task(task)["details"]
    description = details.get("statement_description") or details.get("payment_description") or "the payment shown on my statement"
    amount = details.get("amount") or "the amount shown"
    date = details.get("date") or "the date shown"
    return {
        "next_steps": (
            "1. Check whether the payment is pending or fully posted, and note the description, amount and date.\n"
            "2. Search email receipts and subscription lists, including Apple, Google Play, Amazon and PayPal.\n"
            "3. Ask household members whether they recognise it without sharing card, login or security details.\n"
            "4. If it remains unrecognised, contact the bank or card provider using its official app, website or phone number."
        ),
        "provider_message": "",
        "things_to_check": (
            f"- Statement description: {description}.\n"
            f"- Amount and date: {amount}; {date}.\n"
            "- Check whether it repeats monthly or annually.\n"
            "- Check Apple, Google Play, Amazon, PayPal and household accounts.\n"
            "- Do not cancel an essential payment until you understand what it is.\n"
            "- Never share passwords, full card numbers or one-time codes."
        ),
        "approval_checklist": (
            "- Confirm the payment is posted before disputing it.\n"
            "- Use only the official bank or card-provider contact route.\n"
            "- Keep a note of the date, amount and statement description.\n"
            "- Approve any dispute, payment cancellation or replacement-card action yourself."
        ),
        "provider_email": {
            "subject": "Query about an unrecognised payment",
            "body": (
                f"Hello,\n\nI am trying to identify a payment shown as ‘{description}’ for {amount} on {date}. "
                "I do not recognise it. Please confirm what merchant or payment information you can provide, whether it is pending or posted, "
                "and the safest next step if I still do not recognise it.\n\nThank you."
            ),
            "kind": "bank_query",
        },
    }
