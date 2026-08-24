-- Term sheets — digitaal ondertekenen (/ondertekenen). Additieve migratie:
-- voer dit los uit in de Supabase SQL-editor; raakt geen bestaande tabellen.
--
-- payload = { bodyHtml, diagramLayout, signers, docuseal } (vrije jsonb; de
-- documentinhoud is bewerkte HTML, zie src/lib/termsheet.ts).

create table if not exists term_sheets (
  id uuid primary key default gen_random_uuid(),
  dossier_slug text,
  title text not null,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft','sent')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists term_sheets_updated_idx on term_sheets (updated_at desc);
create index if not exists term_sheets_dossier_idx on term_sheets (dossier_slug);

alter table term_sheets enable row level security;

-- De app schrijft via de service-role (bypasst RLS); defense-in-depth policy
-- zoals bij kaart_drafts: enkel editor/admin via user-scoped clients.
drop policy if exists term_sheets_manage on term_sheets;
create policy term_sheets_manage on term_sheets for all
  using (app_role() in ('editor','admin'))
  with check (app_role() in ('editor','admin'));
