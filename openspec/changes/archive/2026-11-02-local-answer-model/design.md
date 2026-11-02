## Context

`AnswerModel` is a small interface (question and numbered sources in, raw JSON text out); parsing and
verification happen in the pipeline, not in the model class. A second implementation therefore needs
no change to the pipeline.

## Decisions

- **Selection**: `ANSWER_PROVIDER` is `claude` (default) or `ollama`; any other value is a configuration error.
- **Ollama call**: `POST {OLLAMA_URL}/api/chat` with `stream: false`, the same system prompt and user
  message as for Claude, and `format` set to the output JSON schema so the server constrains the output
  to valid JSON. The raw `message.content` goes to the existing parser.
- **Configuration**: `OLLAMA_URL` defaults to `http://localhost:11434`; `OLLAMA_MODEL` is required and has
  no default in code, as with the Claude model id. A missing model is a configuration error and sends no request.
- **Sampling**: temperature 0 and a fixed context window large enough for 8 sources, so a run is
  repeatable on the same model.
- **No network beyond the configured URL**: the provider only calls the configured Ollama URL.
- **Errors**: an unreachable server, a non-2xx status, or a malformed body is a model failure, which the
  pipeline already turns into a refusal; details are logged on the server only.
- **Labeling**: eval result files record provider and model; the README table names them. Results from a
  local model are never described as Claude results.
- **Model choice**: no model is recommended in advance. Candidates are compared by running the answer
  eval; the README reports what was measured.

## Risks

- Small local models may copy quotes less exactly, so the strict refusal rule can refuse many answers;
  this is measured and reported, not hidden.
- Ollama's structured output support varies by model and version; the pipeline's own parsing stays authoritative.
