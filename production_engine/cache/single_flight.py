"""
Simple In-Memory Single-Flight Request Coalescer.
Prevents redundant expensive computations when concurrent callers request the exact same cache key.
"""

import threading
from typing import Dict, Any, Callable, TypeVar, Optional

T = TypeVar("T")


class _Call:
    def __init__(self):
        self.event = threading.Event()
        self.result: Any = None
        self.error: Optional[Exception] = None


class SingleFlightGroup:
    """Thread-safe request coalescer for identical in-flight operations."""

    def __init__(self):
        self._mutex = threading.Lock()
        self._calls: Dict[str, _Call] = {}

    def do(self, key: str, fn: Callable[[], T]) -> T:
        """
        Executes fn only once for a given key among concurrent callers.
        Subsequent callers wait for the active execution and return the shared result.
        """
        with self._mutex:
            if key in self._calls:
                call = self._calls[key]
                # Another thread is already computing this key
                wait_for_existing = True
            else:
                call = _Call()
                self._calls[key] = call
                wait_for_existing = False

        if wait_for_existing:
            call.event.wait()
            if call.error:
                raise call.error
            return call.result

        # This thread performs the computation
        try:
            call.result = fn()
        except Exception as e:
            call.error = e
            raise e
        finally:
            with self._mutex:
                if key in self._calls:
                    del self._calls[key]
            call.event.set()

        return call.result
