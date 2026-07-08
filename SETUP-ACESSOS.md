# Configuração do sistema de acessos (cadastro + aprovação)

O código já está pronto. Faltam **3 passos** que só você pode fazer, porque envolvem a sua conta.

## 1. Criar o banco de dados (Supabase — grátis)

1. Acesse **https://supabase.com** e crie uma conta (pode usar o Google/GitHub).
2. Clique em **New project**. Dê um nome (ex.: `gbm-intelligence`), escolha uma senha do banco e a região **South America (São Paulo)**.
3. Aguarde ~2 min até o projeto ficar pronto.

## 2. Criar a tabela de usuários

1. No projeto Supabase, menu lateral → **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/schema.sql` (deste repositório), copie todo o conteúdo, cole e clique em **Run**.
3. Deve aparecer "Success". Pronto — a tabela `usuarios` foi criada.

## 3. Pegar as chaves e configurar no Vercel

No Supabase: menu **Settings** (engrenagem) → **API**. Você vai precisar de:

- **Project URL** (algo como `https://xxxx.supabase.co`)
- **service_role** key (em *Project API keys* → clique em "Reveal" na linha `service_role`)
  - ⚠️ Essa chave é secreta. Nunca compartilhe nem coloque no front-end. Ela só vai no Vercel.

Depois, no **Vercel** (painel do projeto `gbm-intelligence`) → **Settings** → **Environment Variables**, adicione as 3 variáveis:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | a *Project URL* do Supabase |
| `SUPABASE_SERVICE_KEY` | a chave *service_role* do Supabase |
| `ADMIN_SECRET` | uma senha forte inventada por você (essa é a **senha master** do painel de aprovação) |

Marque as três para **Production** (e Preview, se quiser testar em preview). Salve.

## 4. Redeploy

No Vercel → aba **Deployments** → no último deploy, menu **⋯** → **Redeploy**. Isso aplica as variáveis novas.

---

## Como usar

- **Cliente:** na tela de login, clica em **"Criar conta"**, preenche e envia. O acesso fica *pendente*.
- **Você (master):** na tela de login, clica em **"⚙ Acesso administrativo"** (embaixo), digita a `ADMIN_SECRET`, e cai no **Painel Master**. Lá você vê os cadastros pendentes e, num clique, define o plano (**Free / Business / Pró**) — o que já aprova o acesso. Pode rejeitar ou reverter também.
- O cliente consegue entrar assim que você aprovar.

## Regras de acesso implementadas

| Recurso | Free | Business | Pró |
|---|---|---|---|
| LME / Mercado | ✅ | ✅ | ✅ |
| Calculadora | — | ✅ | ✅ |
| Consulta (CNPJ) | — | ✅ ilimitado | ✅ ilimitado |
| Prospecção | — | ✅ ilimitado | ✅ ilimitado |
| Prospecção Avançada | — | ✅ **10/semana** (acumulativo, renova seg.) | ✅ ilimitado |
| Crédito | — | — | ✅ |

> Obs.: o módulo **Crédito** ficou como exclusivo do **Pró** (não estava na sua lista do Business). Se quiser liberar para Business também, é só avisar.
>
> Na Prospecção Avançada, **cada busca de empresa = 1 consulta** (dos 10 créditos semanais). Os créditos não usados acumulam para a semana seguinte. O controle é no servidor, então não dá pra burlar limpando o navegador.
