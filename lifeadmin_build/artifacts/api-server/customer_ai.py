"""Ephemeral customer-key relay for supported household AI providers.

The app passes a key and reviewed prompt for one request. This module never
persists either value and never returns provider error bodies to the client.
"""
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from urllib.parse import urlsplit


PROVIDERS = {"openai", "gemini", "anthropic"}
_SYSTEM = (
    "Help with household bills using plain language and the supplied facts. "
    "Never invent prices, savings, availability, eligibility, dates, fees or legal rights. "
    "For live research, cite official provider sources and distinguish checked facts, "
    "estimates and unknowns. If evidence is missing, say so. Never contact providers, "
    "change services, make payments or take actions. The user reviews every result."
)


def _sources(items):
    result = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        title = item.get("title")
        try:
            parsed = urlsplit(url) if isinstance(url, str) else None
            if not parsed or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                continue
        except ValueError:
            continue
        if url in seen:
            continue
        seen.add(url)
        result.append({"title": (title if isinstance(title, str) and title.strip() else parsed.hostname)[:200], "url": url[:2000]})
        if len(result) == 20:
            break
    return result


def _post(url, headers, payload):
    request = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, response_headers, newurl):
            return None

    try:
        opener = urllib.request.build_opener(NoRedirect)
        with opener.open(request, timeout=90) as response:
            raw = response.read(1_000_001)
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise RuntimeError("provider_limit") from None
        if exc.code in (401, 403):
            raise RuntimeError("provider_key") from None
        raise RuntimeError("provider_unavailable") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RuntimeError("provider_unavailable") from None
    if len(raw) > 1_000_000:
        raise RuntimeError("provider_response")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError("provider_response") from None
    if not isinstance(result, dict):
        raise RuntimeError("provider_response")
    return result


def _openai(prompt, api_key, search):
    model = os.environ.get("CUSTOMER_OPENAI_MODEL", "gpt-5-mini")
    payload = {"model": model, "input": [
        {"role": "developer", "content": _SYSTEM},
        {"role": "user", "content": prompt},
    ]}
    if search:
        payload["tools"] = [{"type": "web_search"}]
    data = _post("https://api.openai.com/v1/responses", {
        "Authorization": "Bearer " + api_key, "Content-Type": "application/json",
    }, payload)
    body = data.get("output_text") if isinstance(data.get("output_text"), str) else ""
    citations = []
    searched = False
    for item in data.get("output", []) if isinstance(data.get("output"), list) else []:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "web_search_call":
            searched = True
        for block in item.get("content", []) if isinstance(item.get("content"), list) else []:
            if not isinstance(block, dict):
                continue
            if not body and block.get("type") in ("output_text", "text") and isinstance(block.get("text"), str):
                body += block["text"]
            for annotation in block.get("annotations", []) if isinstance(block.get("annotations"), list) else []:
                if not isinstance(annotation, dict):
                    continue
                citation = annotation.get("url_citation", annotation)
                if isinstance(citation, dict):
                    start, end = citation.get("start_index"), citation.get("end_index")
                    claim = body[start:end].strip()[:1000] if isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(body) else ""
                    citations.append({"claim": claim, "sources": [{"title": citation.get("title", "Web source"), "url": citation.get("url", "")} ]})
    sources = _sources([source for citation in citations for source in citation["sources"]])
    return body.strip(), sources, citations, model, searched


def _anthropic(prompt, api_key, search):
    model = os.environ.get("CUSTOMER_ANTHROPIC_MODEL", "claude-sonnet-4-6")
    payload = {"model": model, "max_tokens": 5000, "system": _SYSTEM,
               "messages": [{"role": "user", "content": prompt}]}
    if search:
        payload["tools"] = [{"type": "web_search_20260318", "name": "web_search"}]
    data = _post("https://api.anthropic.com/v1/messages", {
        "x-api-key": api_key, "anthropic-version": "2026-10-21", "Content-Type": "application/json",
    }, payload)
    blocks = data.get("content", []) if isinstance(data.get("content"), list) else []
    body_parts, sources, citations = [], [], []
    searched = False
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and isinstance(block.get("text"), str):
            body_parts.append(block["text"])
            for citation in block.get("citations", []) if isinstance(block.get("citations"), list) else []:
                if isinstance(citation, dict):
                    source = {"title": citation.get("title", "Web source"), "url": citation.get("url", "")}
                    citations.append({"claim": str(citation.get("cited_text", ""))[:1000], "sources": [source]})
                    sources.append(source)
        if block.get("type") == "web_search_tool_result":
            searched = True
            for result in block.get("content", []) if isinstance(block.get("content"), list) else []:
                if isinstance(result, dict):
                    sources.append({"title": result.get("title", "Web source"), "url": result.get("url", "")})
    return "\n".join(body_parts).strip(), _sources(sources), citations[:100], model, searched


def _gemini(prompt, api_key, search):
    model = os.environ.get("CUSTOMER_GEMINI_MODEL", "gemini-3.5-flash-lite")
    if not re.fullmatch(r"gemini-[A-Za-z0-9.-]{2,80}", model):
        raise RuntimeError("provider_unavailable")
    payload = {
        "systemInstruction": {"parts": [{"text": _SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 5000},
    }
    if search:
        payload["tools"] = [{"google_search": {}}]
    data = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", {
        "x-goog-api-key": api_key, "Content-Type": "application/json",
    }, payload)
    candidates = data.get("candidates") if isinstance(data.get("candidates"), list) else []
    candidate = candidates[0] if candidates and isinstance(candidates[0], dict) else {}
    content = candidate.get("content") if isinstance(candidate.get("content"), dict) else {}
    parts = content.get("parts") if isinstance(content.get("parts"), list) else []
    body = "".join(part.get("text", "") for part in parts if isinstance(part, dict) and isinstance(part.get("text"), str)).strip()
    metadata = candidate.get("groundingMetadata") if isinstance(candidate.get("groundingMetadata"), dict) else {}
    chunks = metadata.get("groundingChunks") if isinstance(metadata.get("groundingChunks"), list) else []
    chunk_sources = []
    for chunk in chunks[:20]:
        web = chunk.get("web") if isinstance(chunk, dict) else None
        if isinstance(web, dict):
            chunk_sources.append({"title": web.get("title", "Web source"), "url": web.get("uri", "")})
        else:
            chunk_sources.append(None)
    sources = _sources([item for item in chunk_sources if item])
    citations = []
    for support in metadata.get("groundingSupports", []) if isinstance(metadata.get("groundingSupports"), list) else []:
        if not isinstance(support, dict):
            continue
        segment = support.get("segment") if isinstance(support.get("segment"), dict) else {}
        claim = segment.get("text")
        indices = support.get("groundingChunkIndices")
        if isinstance(claim, str) and isinstance(indices, list):
            linked = [chunk_sources[i] for i in indices if isinstance(i, int) and 0 <= i < len(chunk_sources) and chunk_sources[i]]
            valid = _sources(linked)
            if valid:
                citations.append({"claim": claim[:1000], "sources": valid[:5]})
    suggestion = metadata.get("searchEntryPoint") if isinstance(metadata.get("searchEntryPoint"), dict) else {}
    suggestions_html = suggestion.get("renderedContent") if isinstance(suggestion.get("renderedContent"), str) else ""
    return body, sources, citations[:100], model, bool(metadata.get("googleSearchQueries")) or bool(sources), suggestions_html


def generate(provider, api_key, prompt, output, search):
    if not isinstance(provider, str) or provider not in PROVIDERS:
        raise ValueError("Choose a supported AI provider.")
    if not isinstance(api_key, str) or not 10 <= len(api_key) <= 512 or not re.fullmatch(r"[A-Za-z0-9._-]+", api_key):
        raise ValueError("Enter a valid provider API key.")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 20000:
        raise ValueError("Review a request of up to 20,000 characters.")
    if not isinstance(output, str) or output not in {"plan", "letter", "reply"} or not isinstance(search, bool) or (search and output != "plan"):
        raise ValueError("Review the selected household-bill task.")
    extra = ""
    if provider == "openai":
        body, sources, citations, model, searched = _openai(prompt, api_key, search)
    elif provider == "anthropic":
        body, sources, citations, model, searched = _anthropic(prompt, api_key, search)
    else:
        result = _gemini(prompt, api_key, search)
        body, sources, citations, model, searched, extra = result
    if not body or len(body) > 20000:
        raise RuntimeError("provider_response")
    if search and (not searched or not sources):
        raise RuntimeError("research_evidence")
    return {
        "body": body,
        "sources": sources,
        "citations": citations,
        "checked_at": datetime.now(timezone.utc).isoformat() if search else "",
        "model": model,
        "provider": provider,
        "search_suggestions_html": extra[:20000],
    }
