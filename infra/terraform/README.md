# Terraform Infra

Infraestrutura GCP/Firebase gerenciada via OpenTofu para os ambientes de `staging` e `production`.

O repositorio fixa a versao de OpenTofu em [`.opentofu-version`](/Users/elvishenriquepereira/projects/menu/.opentofu-version), e os workflows usam esse mesmo arquivo para manter consistencia entre ambiente local e GitHub Actions.

## Estrutura

```text
bootstrap/                 cria o bucket remoto de state
modules/project_baseline/  APIs e IAM base do projeto
modules/functions_runtime/ grants para runtime das Functions e deploy do app
environments/staging/      stack de staging
environments/production/   stack de production
```

## Backend remoto

O state deve ficar em um bucket GCS dedicado, com versionamento habilitado.

Sugestao de layout:

- bucket: `maresia-grill-terraform-state`
- prefixo `staging`
- prefixo `production`

Os exemplos `backend.hcl.example` mostram a configuracao esperada para uso local. Nos workflows, o backend e informado por parametro com `bucket` e `prefix`.

## Bootstrap inicial

Execute uma vez para criar o bucket remoto de state:

```bash
tofu -chdir=infra/terraform/bootstrap init
tofu -chdir=infra/terraform/bootstrap apply \
  -var="project_id=<project-id>" \
  -var="region=us-central1" \
  -var="state_bucket_name=maresia-grill-terraform-state"
```

## Uso local

Exemplo para `staging`:

```bash
tofu -chdir=infra/terraform/environments/staging init \
  -backend-config=backend.hcl

tofu -chdir=infra/terraform/environments/staging plan \
  -var="project_id=<project-id>" \
  -var="project_number=<project-number>" \
  -var="region=us-central1" \
  -var="app_deployer_member=serviceAccount:<sa-email>"
```

Para `production`, troque apenas o diretório do ambiente e os valores das variaveis.

## GitHub Actions

Workflows relacionados:

- `Infra Plan`: roda em PRs com mudancas em `infra/terraform/**`
- `Infra Apply`: apply manual via `workflow_dispatch`

Variaveis e segredos esperados:

- `vars.TF_STATE_BUCKET`
- `vars.GCP_PROJECT_ID_STAGING`
- `vars.GCP_PROJECT_NUMBER_STAGING`
- `vars.APP_DEPLOYER_MEMBER_STAGING`
- `vars.GCP_PROJECT_ID_PRODUCTION`
- `vars.GCP_PROJECT_NUMBER_PRODUCTION`
- `vars.APP_DEPLOYER_MEMBER_PRODUCTION`
- `secrets.GCP_TERRAFORM_CREDENTIALS_STAGING`
- `secrets.GCP_TERRAFORM_CREDENTIALS_PRODUCTION`

## Limites de responsabilidade

- O pipeline de infra e a camada autorizada a alterar IAM estrutural.
- O pipeline de deploy do app nao deve fazer mudancas estruturais de IAM.
- `render.yaml` continua sendo a fonte declarativa do frontend no Render.
- `firebase.json` e os workflows de deploy do app cuidam apenas de Functions e Firestore Rules.
