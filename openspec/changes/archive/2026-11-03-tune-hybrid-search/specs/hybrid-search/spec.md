## ADDED Requirements

### Requirement: Hybrid is not worse than its vector component
The default search configuration SHALL NOT be significantly worse, on the held-out questions of the retrieval eval, than vector-only search with the same embedding model; if no hybrid configuration meets this, the default SHALL be the best measured configuration and the decision record SHALL state why.

#### Scenario: Hybrid underperforms
- **WHEN** no measured hybrid variant is at least as good as vector-only within the stated noise on the held-out questions
- **THEN** the default is not hybrid and the decision record states the finding and the numbers

### Requirement: Fusion weights are explicit
Any weighting of the full-text ranking against the vector ranking SHALL be an explicit, documented search option with a stated default, and SHALL NOT be implied by constants hidden in the code.

#### Scenario: Weight changed
- **WHEN** a different full-text weight is given in the search options
- **THEN** the ranking changes accordingly and a test shows the effect on a fixture
