# Repository Collaboration Conventions

## Commits
- Follow [Conventional Commits](https://www.conventionalcommits.org) for every change.
- Keep the commit subject line in English; summarize the intent concisely.
- The commit body must include at least one paragraph written in Chinese that explains the change in detail.
- When a commit needs multiple body lines or paragraphs, use multiple `-m` flags; never embed literal `\n` sequences in the commit message.
- Never amend (rebase, --amend, fixup, squash) an existing commit unless explicitly requested.
- Before signaling completion, execute the applicable verification steps (tests, linters, smoke checks) that the change depends on and record any deviations in the pull request or issue.

## Documentation Language Defaults
- User-facing documentation should be written in Chinese unless the reader explicitly requests another language.
- Development-focused documentation (design notes, implementation guides, troubleshooting) should also default to Chinese, but may include English code snippets and terminology where clarity demands it.

## Code Identifiers and Shell References
- Keep identifiers, file paths, commands, and environment variable names in English so tooling and scripting remain predictable.
- If a term must appear in Chinese, add an English alias or transliteration immediately after for clarity.

## Workflow Reminders
- Keep personal/private artifacts (notes, dumps, `.local-notes/`, `dst/`, `ugc/`, `data/`, `.tmp/`, etc.) out of version control per the `.gitignore` rules.
- Before requesting a review or marking the task as done, double-check `git status` to confirm no private files are staged and attach logs from the last verification run if it would help understanding.
