import math
import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

MINUTE = 60
DAY = 24 * 60 * 60
SWEEP_THRESHOLD = 10000

# Set by the proxies in front of Render; the socket peer is the proxy itself.
CLIENT_IP_HEADERS = ("cf-connecting-ip", "true-client-ip")


def _limit(name, default):
    """A limit of 0 turns that check off."""
    return int(os.getenv(name) or default)


def client_ip(request: Request):
    for header in CLIENT_IP_HEADERS:
        value = request.headers.get(header)
        if value:
            return value.strip()

    # The proxy appends the address it saw, so the last entry is the one the
    # client cannot forge.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()

    return request.client.host if request.client else "unknown"


class RateLimiter:
    """
    Sliding-window counters kept in memory. That is enough for a single API
    instance; more than one instance would need a shared store such as Redis.
    """

    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def _sweep(self, now):
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= now - DAY]
        for key in stale:
            del self._hits[key]

    def check(self, rules):
        """
        rules: (key, limit, window_seconds) tuples. Every rule has to pass before
        any of them records the hit, so a rejected request does not use up quota.
        Returns the seconds to wait, or None when the request is allowed.
        """
        now = time.monotonic()
        rules = [rule for rule in rules if rule[1] > 0]

        with self._lock:
            if len(self._hits) > SWEEP_THRESHOLD:
                self._sweep(now)

            for key, limit, window in rules:
                hits = self._hits[key]
                while hits and hits[0] <= now - window:
                    hits.popleft()
                if len(hits) >= limit:
                    return max(1, math.ceil(hits[0] + window - now))

            for key, _, _ in rules:
                self._hits[key].append(now)

        return None


_limiter = RateLimiter()


def rate_limit(scope, per_minute, per_day, global_per_day=0):
    """FastAPI dependency limiting one endpoint per client IP and in total."""

    def dependency(request: Request):
        ip = client_ip(request)
        retry_after = _limiter.check(
            [
                (f"{scope}:minute:{ip}", per_minute, MINUTE),
                (f"{scope}:day:{ip}", per_day, DAY),
                (f"{scope}:global:day", global_per_day, DAY),
            ]
        )
        if retry_after is None:
            return

        print(f"Rate limited {scope} for {ip}; retry in {retry_after}s")
        raise HTTPException(
            status_code=429,
            detail="Too many questions in a short time. Please wait a moment and try again.",
            headers={"Retry-After": str(retry_after)},
        )

    return dependency


chat_limit = rate_limit(
    "chat",
    per_minute=_limit("RATE_LIMIT_CHAT_PER_MINUTE", 10),
    per_day=_limit("RATE_LIMIT_CHAT_PER_DAY", 200),
    global_per_day=_limit("RATE_LIMIT_CHAT_GLOBAL_PER_DAY", 2000),
)

retrieve_limit = rate_limit(
    "retrieve",
    per_minute=_limit("RATE_LIMIT_RETRIEVE_PER_MINUTE", 30),
    per_day=_limit("RATE_LIMIT_RETRIEVE_PER_DAY", 500),
    global_per_day=_limit("RATE_LIMIT_RETRIEVE_GLOBAL_PER_DAY", 5000),
)
