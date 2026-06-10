"""Japanese language tooling (Phase 2): tokenisation and dictionary lookup.

Deterministic, local, no LLM. The tokenizer (SudachiPy) powers furigana and
provides the dictionary-form lemmas that the dictionary (JMdict + KANJIDIC2)
uses for hover-lookup; the grammar module detects multi-token constructions
(〜ている, 〜てしまう, …) over the token stream for the hover popup.
"""

from app.japanese.dictionary import Dictionary
from app.japanese.grammar import detect_grammar
from app.japanese.tokenizer import Tokenizer

__all__ = ["Dictionary", "Tokenizer", "detect_grammar"]
