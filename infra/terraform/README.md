# Terraform Infra

Infraestrutura GCP/Firebase gerenciada via Terraform/OpenTofu.

O repositório fixa a versão de OpenTofu em [`.opentofu-version`](/Users/elvishenriquepereira/projects/menu/.opentofu-version) para alinhar ambiente local e GitHub Actions.

## Estrutura

- `bootstrap/`: cria o bucket remoto de state em GCS
- `modules/project_baseline/`: APIs e IAM base do projeto
- `modules/functions_runtime/`: grants do runtime das Functions e do deployer do app
- `environments/staging/`: stack do ambiente de staging
- `environments/production/`: stack do ambiente de produção

## Backend remoto

O state fica em um bucket GCS dedicado, com versionamento habilitado.

Sugestão:

- bucket: `maresia-grill-terraform-state`
- prefixo `staging`
- prefixo `production`

Os arquivos `backend.hcl.example` mostram a configuração esperada para uso local. Nos workflows de CI/CD o backend é passado por parâmetro para evitar duplicação.

## Bootstrap inicial

Crie o bucket de state uma vez antes de usar os ambientes:

```bash
tofu -chdir=infra/terraform/bootstrap init
tofu -chdir=infra/terraform/bootstrap apply \
  -var="project_id=<project-id>" \
  -var="region=us-central1" \
  -var="state_bucket_name=maresia-grill-terraform-state"
```

## Uso local por ambiente

Exemplo para staging:

```bash
tofu -chdir=infra/terraform/environments/staging init \
  -backend-config=backend.hcl

tofu -chdir=infra/terraform/environments/staging plan \
  -var="project_id=<project-id>" \
  -var="project_number=<project-number>" \
  -var="region=us-central1" \
  -var="app_deployer_member=serviceAccount:<sa-email>"
```

## Importante

- O pipeline de infra é a única camada autorizada a alterar IAM estrutural.
- O pipeline de deploy do app não deve chamar `setIamPolicy`.
- `render.yaml` continua sendo a fonte declarativa do frontend/Render.
