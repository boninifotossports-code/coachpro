# CoachPro — Módulo 1: Base + Clube + Elenco

Sistema de gestão esportiva desenvolvido por **AB Labs**. Adaptável para futebol e futsal.

## O que já está pronto neste módulo

- **Login** com Supabase Auth.
- **Controle de acesso**: administradores não expiram; demais usuários (treinador,
  assistente, equipe) recebem acesso válido por **1 ano** a partir da criação da conta.
  Só um **admin** pode renovar (botão "Renovar por 1 ano" na tela **Usuários**) ou trocar
  o papel de alguém. Se o acesso vencer, o usuário vê uma tela de "Acesso expirado" e não
  consegue usar o sistema até o admin renovar.
- **Clube**: dados do time (categoria/escalão, modalidade futebol/futsal, temporada,
  duração de jogo, formato de jogadores), competições disputadas e objetivos,
  responsáveis do clube (presidente, coordenador técnico etc.).
- **Elenco**: lista de atletas com número, nome, apelido, nascimento, idade calculada,
  nacionalidade, posição principal e posições secundárias, telefone.
- Layout responsivo (menu lateral vira gaveta no celular), com a marca CoachPro e o
  crédito "Desenvolvido por AB Labs" no rodapé do menu e na tela de login.

Módulos combinados para as próximas etapas: Súmula com estatísticas automáticas,
Quadro de treinos + exportação em PDF, Banco de exercícios, Controle de presença.
Os itens já aparecem no menu marcados como "em breve".

## 1. Criar o projeto no Supabase

1. Crie uma conta/projeto em https://supabase.com.
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria as tabelas, a segurança por linha (RLS) e a regra de expiração de 1 ano.
3. Vá em **Project Settings → API** e copie:
   - `Project URL` → vai virar `VITE_SUPABASE_URL`
   - `anon public key` → vai virar `VITE_SUPABASE_ANON_KEY`

### Criar o clube e o primeiro administrador

1. Em **Authentication → Users → Invite user**, convide o e-mail do primeiro
   administrador. Ele vai receber um e-mail para definir a senha.
2. No **SQL Editor**, crie o clube:
   ```sql
   insert into public.clubs (name) values ('Nome do seu clube') returning id;
   ```
3. Copie o `id` retornado e vincule o admin a ele (troque o e-mail e o club_id):
   ```sql
   update public.profiles
   set role = 'admin', club_id = 'COLE_O_ID_DO_CLUBE_AQUI', access_expires_at = null
   where id = (select id from auth.users where email = 'email-do-admin@exemplo.com');
   ```
4. Para os próximos usuários, repita o convite pelo Supabase e depois rode:
   ```sql
   update public.profiles set club_id = 'COLE_O_ID_DO_CLUBE_AQUI' where id = (select id from auth.users where email = 'email-da-pessoa@exemplo.com');
   ```
   O acesso de 1 ano já é definido automaticamente na criação.

## 2. Rodar localmente (opcional, para testar antes do deploy)

```bash
npm install
cp .env.example .env
# edite o .env com sua URL e chave do Supabase
npm run dev
```

## 3. Publicar no Netlify

1. Suba esta pasta para um repositório no GitHub (ou arraste a pasta em
   https://app.netlify.com/drop para um teste rápido).
2. Em https://app.netlify.com → **Add new site → Import an existing project**.
3. Build command: `npm run build` · Publish directory: `dist` (já configurado em
   `netlify.toml`).
4. Em **Site settings → Environment variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Clique em **Deploy site**. Pronto, o CoachPro estará no ar e responsivo para celular.

## Estrutura de pastas

```
coachpro/
├── src/
│   ├── assets/            # logos CoachPro
│   ├── components/        # Sidebar, AppLayout, ProtectedRoute
│   ├── lib/                # supabaseClient, AuthContext (login + validade de acesso)
│   └── pages/              # Login, ClubInfo, Squad, AdminUsers
├── supabase/schema.sql    # schema completo com RLS e expiração de 1 ano
└── netlify.toml
```
