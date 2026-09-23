import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database.supabase_client import get_client
from generation.prompts import (
    ANSWER_TEMPLATE,
    CONDENSE_TEMPLATE,
    NO_CONTEXT_REPLY,
    SUMMARY_TEMPLATE,
    SYSTEM_PROMPT,
)
from retrieval.retriever import Retriever, format_context

LLM_DEFAULTS = {
    "local": {"model": "llama3.2", "base_url": "http://localhost:11434/v1"},
    "gemini": {"model": "gemini-2.0-flash", "base_url": None},
    "openai": {"model": "gpt-4o-mini", "base_url": None},
}

MAX_RETRIES = 3
RETRY_BASE_DELAY = 2.0

RECENT_TURNS = 6
HISTORY_CHAR_BUDGET = 6000
CONTEXT_CHAR_BUDGET = 12000
CITATION_CHAR_LIMIT = 1200

CONVERSATIONS_TABLE = "conversations"
MESSAGES_TABLE = "conversation_messages"


def _env(*names):
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _env_model(provider_var, model_var, provider):
    """
    The configured model only belongs to the configured provider. Without this,
    LLM_MODEL=gpt-4o-mini would also be sent to Gemini when a request overrides
    the provider.
    """
    model = os.getenv(model_var)
    if not model:
        return None

    configured = (os.getenv(provider_var) or "").lower()
    if configured and configured != provider:
        return None
    return model


class LLMClient:
    def __init__(self, provider=None, model=None, temperature=0.2, max_tokens=800):
        self.provider = (provider or os.getenv("LLM_PROVIDER") or "local").lower()
        if self.provider not in LLM_DEFAULTS:
            raise ValueError(
                f"Unsupported LLM provider '{self.provider}'. Use one of: {', '.join(LLM_DEFAULTS)}"
            )

        defaults = LLM_DEFAULTS[self.provider]
        self.model = model or _env_model("LLM_PROVIDER", "LLM_MODEL", self.provider) or defaults["model"]
        self.base_url = os.getenv("LOCAL_LLM_BASE_URL") or defaults["base_url"]
        self.temperature = temperature
        self.max_completion_tokens = max_tokens
        self._client = None

    def _openai_compatible(self):
        if self._client is None:
            from openai import OpenAI

            if self.provider == "local":
                self._client = OpenAI(base_url=self.base_url, api_key="not-needed")
            else:
                api_key = _env("OPENAI_API_KEY", "LLM_API_KEY")
                if not api_key:
                    raise RuntimeError("Set OPENAI_API_KEY (or LLM_API_KEY) in .env")
                self._client = OpenAI(api_key=api_key)
        return self._client

    def _gemini(self):
        if self._client is None:
            from google import genai

            api_key = _env("GEMINI_API_KEY", "GOOGLE_API_KEY", "LLM_API_KEY")
            if not api_key:
                raise RuntimeError("Set GEMINI_API_KEY (or LLM_API_KEY) in .env")
            self._client = genai.Client(api_key=api_key)
        return self._client

    def _complete_openai(self, system, messages):
        client = self._openai_compatible()
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system}] + messages,
            temperature=self.temperature,
            max_completion_tokens=self.max_completion_tokens,
        )
        return response.choices[0].message.content.strip()

    def _complete_gemini(self, system, messages):
        from google.genai import types

        client = self._gemini()
        contents = [
            types.Content(
                role="model" if message["role"] == "assistant" else "user",
                parts=[types.Part(text=message["content"])],
            )
            for message in messages
        ]
        response = client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=self.temperature,
                max_output_tokens=self.max_completion_tokens,
            ),
        )
        return (response.text or "").strip()

    def complete(self, system, messages):
        call = self._complete_gemini if self.provider == "gemini" else self._complete_openai

        for attempt in range(MAX_RETRIES):
            try:
                return call(system, messages)
            except Exception as error:
                if self.provider == "local" and "Connection" in type(error).__name__:
                    raise RuntimeError(
                        f"No local LLM is reachable at {self.base_url}. Start Ollama "
                        f"('ollama serve' and 'ollama pull {self.model}'), or call the API "
                        f"with llm_provider set to 'gemini' or 'openai'."
                    ) from error
                if attempt == MAX_RETRIES - 1:
                    raise
                time.sleep(RETRY_BASE_DELAY * (2**attempt))

        return ""


class ConversationStore:
    def __init__(self, client=None):
        self.client = client or get_client()

    def create(self, title=None, llm_provider=None, llm_model=None):
        payload = {"title": title, "llm_provider": llm_provider, "llm_model": llm_model}
        response = self.client.table(CONVERSATIONS_TABLE).insert(payload).execute()
        return response.data[0]["id"]

    def get(self, conversation_id):
        response = (
            self.client.table(CONVERSATIONS_TABLE)
            .select("*")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def messages(self, conversation_id, limit=None):
        query = (
            self.client.table(MESSAGES_TABLE)
            .select("role, content, sources, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at")
        )
        if limit:
            query = query.limit(limit)
        return query.execute().data or []

    def add_message(self, conversation_id, role, content, sources=None):
        self.client.table(MESSAGES_TABLE).insert(
            {
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
                "sources": sources or [],
            }
        ).execute()

    def set_summary(self, conversation_id, summary):
        self.client.table(CONVERSATIONS_TABLE).update({"summary": summary}).eq(
            "id", conversation_id
        ).execute()

    def delete(self, conversation_id):
        self.client.table(CONVERSATIONS_TABLE).delete().eq("id", conversation_id).execute()


def render_history(messages):
    return "\n".join(
        f"{'Student' if message['role'] == 'user' else 'Assistant'}: {message['content']}"
        for message in messages
    )


class AnswerGenerator:
    def __init__(self, retriever=None, llm=None, store=None):
        self.retriever = retriever or Retriever()
        self.llm = llm or LLMClient()
        self.store = store or ConversationStore(self.retriever.client)

    def condense(self, question, history):
        if not history:
            return question

        prompt = CONDENSE_TEMPLATE.format(
            history=render_history(history[-RECENT_TURNS:]), question=question
        )
        rewritten = self.llm.complete(SYSTEM_PROMPT, [{"role": "user", "content": prompt}])
        return rewritten.strip().strip('"') or question

    def summarise(self, messages):
        prompt = SUMMARY_TEMPLATE.format(history=render_history(messages))
        return self.llm.complete(SYSTEM_PROMPT, [{"role": "user", "content": prompt}])

    def _trim_history(self, conversation_id, summary, messages):
        """Keep recent turns verbatim; fold anything older into a rolling summary."""
        if len(messages) <= RECENT_TURNS:
            return summary, messages

        if len(render_history(messages)) <= HISTORY_CHAR_BUDGET:
            return summary, messages

        older, recent = messages[:-RECENT_TURNS], messages[-RECENT_TURNS:]
        combined = older if not summary else [{"role": "user", "content": summary}] + older
        summary = self.summarise(combined)
        self.store.set_summary(conversation_id, summary)
        return summary, recent

    def answer(
        self,
        question,
        conversation_id=None,
        match_count=None,
        threshold=None,
        sources=None,
        document_type=None,
        academic_level=None,
        hybrid=True,
    ):
        started = time.time()

        if conversation_id is None:
            conversation_id = self.store.create(
                title=question[:120], llm_provider=self.llm.provider, llm_model=self.llm.model
            )
            conversation = {"summary": None}
            history = []
        else:
            conversation = self.store.get(conversation_id)
            if conversation is None:
                raise LookupError(f"Conversation {conversation_id} not found")
            history = self.store.messages(conversation_id)

        summary = conversation.get("summary")
        summary, history = self._trim_history(conversation_id, summary, history)

        search_query = self.condense(question, history)

        search_kwargs = {
            "sources": sources,
            "document_type": document_type,
            "academic_level": academic_level,
            "hybrid": hybrid,
        }
        if match_count is not None:
            search_kwargs["match_count"] = match_count
        if threshold is not None:
            search_kwargs["threshold"] = threshold

        results = self.retriever.search(search_query, **search_kwargs)

        if not results:
            answer_text = NO_CONTEXT_REPLY
        else:
            context = format_context(results, max_chars=CONTEXT_CHAR_BUDGET)
            messages = []
            if summary:
                messages.append(
                    {"role": "user", "content": f"Earlier in this conversation: {summary}"}
                )
                messages.append({"role": "assistant", "content": "Understood."})
            messages.extend(
                {"role": message["role"], "content": message["content"]} for message in history
            )
            messages.append(
                {
                    "role": "user",
                    "content": ANSWER_TEMPLATE.format(context=context, question=question),
                }
            )
            answer_text = self.llm.complete(SYSTEM_PROMPT, messages)

        citations = [
            {
                "index": position,
                "chunk_id": result.get("id"),
                "source": result.get("source"),
                "title": result.get("title"),
                "section_title": result.get("section_title"),
                "page_start": result.get("page_start"),
                "page_end": result.get("page_end"),
                "similarity": result.get("similarity"),
                "content": (result.get("content") or "")[:CITATION_CHAR_LIMIT],
            }
            for position, result in enumerate(results, start=1)
        ]

        self.store.add_message(conversation_id, "user", question)
        self.store.add_message(conversation_id, "assistant", answer_text, citations)

        try:
            self.retriever.log_query(question, answer=answer_text, results=results)
        except Exception as error:
            print(f"  query_logs write failed: {error}")

        return {
            "conversation_id": conversation_id,
            "question": question,
            "search_query": search_query,
            "answer": answer_text,
            "citations": citations,
            "llm": f"{self.llm.provider}/{self.llm.model}",
            "latency_ms": int((time.time() - started) * 1000),
        }
