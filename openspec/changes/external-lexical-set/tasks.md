## 1. Samples and instruction

- [ ] 1.1 Add the sampling command with a recorded seed, stratified by law, one batch per writer, with tests
- [ ] 1.2 Write the instruction text given to the writers and keep it in the repository

## 2. Conversion and validation

- [ ] 2.1 Convert stored raw writer output into the external question set with writer and origin fields, with tests
- [ ] 2.2 Validate structure, expected units, duplicates of existing questions, and flag doubtful items

## 3. Results

- [ ] 3.1 Run the retrieval eval on the external set and record the results
- [ ] 3.2 Report them per writer and overall in a separate table, with what the set shows and does not show
- [ ] 3.3 Run `openspec archive external-lexical-set` and keep the Purpose sections filled
