# ANQ Next Step editing guide

```text
src/client/
  App.tsx             Authenticated data loading, mutation orchestration and page composition
  pages/              Main views, details and sign-in
  components/         Small reusable controls, dialog, field labels and record forms
  layouts/Workspace.tsx Shared sidebar, topbar, export and main reading area
  navigation.ts       View/record links and browser history
  lib/presentation.ts App-local display labels and dates
  types.ts            Client session/modal/view types
  *.css               Semantic tokens and responsive styles
src/server/           Authentication, validation and persistence
src/shared/model.ts   Shared validation and domain rules
```

`pages/Applications.tsx` owns the pipeline, follow-up list and activity views;
`pages/ApplicationDetail.tsx` owns the selected application. Shared ApplicationCard,
History and Stage components keep those views aligned. `navigation.ts` validates
view selection and preserves the deployment prefix, unrelated query parameters
and browser history. It stores the selected record only for Applications.

For setup, test commands, extension points and contribution conventions, read
[CONTRIBUTING.md](../CONTRIBUTING.md). Keep generated output, private configuration
and credentials out of source. Page/component separation does not move authority
from the API to the browser. Use isolated test schemas for behaviour changes.
