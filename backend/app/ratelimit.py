"""Per-IP rate limiting.

A thin wrapper over slowapi. The limiter is applied globally via
``SlowAPIMiddleware`` (see ``app/main.py``) so feature code stays untouched —
no per-route decorators, no ``Request`` parameters threaded through endpoints.

Local-first: with no ``KAIWA_RATE_LIMIT`` configured the limiter is disabled and
every call is a no-op. The hosted demo sets it to cap abuse of the metered cloud
providers, where one scripted client could otherwise burn the budget.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import Settings


def build_limiter(settings: Settings) -> Limiter:
    """Build a limiter from the configured comma-separated limit strings.

    An empty setting yields a disabled limiter, so the middleware can always be
    installed unconditionally and simply does nothing in the local default.
    """
    limits = [limit.strip() for limit in settings.rate_limit.split(",") if limit.strip()]
    return Limiter(
        key_func=get_remote_address,
        default_limits=limits,
        enabled=bool(limits),
    )
