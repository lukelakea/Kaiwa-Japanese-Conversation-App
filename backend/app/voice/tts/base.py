"""The provider-agnostic text-to-speech interface.

This is the seam that keeps the ``/tts`` router independent of any particular
speech engine. Adding a new backend means writing one class that implements
:class:`TTSProvider` — no router changes.

Two engines differ in shape, reconciled behind the interface:

* **Audio format.** VOICEVOX returns WAV, Google returns MP3. ``TTSResult``
  carries the MIME type so the client can wrap the bytes correctly for playback.
* **Mora timings.** VOICEVOX exposes per-mora timing for karaoke-style
  highlighting; Google does not. Providers without timing return an empty list,
  and the frontend degrades to plain playback (no highlight).
"""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass, field


@dataclass(frozen=True)
class MoraTiming:
    """A unit of pronunciation with its hiragana reading and time range (seconds)."""

    text: str
    start: float
    end: float


@dataclass(frozen=True)
class SpeakerOption:
    """A selectable voice, identified by an engine-specific integer id."""

    id: int
    name: str


@dataclass(frozen=True)
class TTSResult:
    """Synthesised audio plus optional per-mora timing for text highlighting."""

    audio: bytes
    mime_type: str
    moras: list[MoraTiming] = field(default_factory=list)


class TTSError(RuntimeError):
    """Raised when synthesis fails, carrying a client-safe message (→ HTTP 502)."""


class TTSProvider(ABC):
    """Abstract text-to-speech engine."""

    @abstractmethod
    async def synthesize(self, text: str, speaker_id: int | None = None) -> TTSResult:
        """Convert Japanese ``text`` to speech.

        ``speaker_id`` overrides the provider's default voice where the engine
        supports voice selection; providers without it ignore the argument.
        Implementations raise :class:`TTSError` if synthesis cannot complete.
        """
        raise NotImplementedError

    async def list_speakers(self) -> Sequence[SpeakerOption]:
        """Return selectable voices, or an empty list if the engine has none."""
        return []

    async def aclose(self) -> None:  # noqa: B027 — optional no-op hook, not abstract
        """Release any held resources (network clients, etc.). Optional override."""
