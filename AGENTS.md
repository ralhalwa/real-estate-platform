# Repository structure

The `web/` directory is part of this repository, not a submodule or nested Git repository.
Keep commits and GitHub pushes in the repository root. Do not initialize or restore `web/.git`.
If a hosting service needs a separate source repository, use a separate checkout outside this project and copy the website source into it.
The original website Git history is preserved locally in `.git/backups/web-original-20261025.git`.
