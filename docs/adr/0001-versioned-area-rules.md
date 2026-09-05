# Preserve an explicit area ruleset in replay saves

Use Chinese-style area scoring with positional superko, mutual dead-group
agreement and resumption, named `area-psk-v1`. Positional superko gives online
play an unambiguous repetition decision without a referee; this deliberately
differs from some tournament interpretations of Chinese rules. Saves contain
canonical actions plus this ruleset identifier, so changing repetition or
scoring semantics requires a new ruleset or migration rather than silently
changing which historical moves were legal.
