#!/usr/bin/env bash

set -euo pipefail

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Existem mudanças locais não commitadas. Commit antes de publicar em staging."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$current_branch" = "HEAD" ]; then
  echo "Estado detached HEAD não suportado. Faça checkout de uma branch antes de publicar em staging."
  exit 1
fi

echo "Publicando ${current_branch} em origin/staging"
git push origin HEAD:staging
