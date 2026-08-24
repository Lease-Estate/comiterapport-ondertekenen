# Digitaal ondertekenen — term sheets & vrije documenten (DocuSeal)

Deelbare module uit de Lease Estate Comitérapport-app (Next.js 14 App Router):
term sheets opstellen, bewerken en digitaal laten ondertekenen via een
zelf-gehoste [DocuSeal](https://www.docuseal.com)-instantie, plus een vrije
flow voor het ondertekenen van geüploade PDF's met sleepbare velden.

## Wat zit erin

| Pad | Inhoud |
| --- | --- |
| `src/lib/termsheet.ts` | Types, invulvelden, clausule-presets, standaardtoelichtingen, HTML-template, opbouw van de onderteken-HTML (incl. "Toelichting"-bijlage met verwijsnummers) |
| `src/lib/termsheet-css.ts` | Scoped CSS van het document (A4/print incluis) |
| `src/lib/termsheet-diagram.ts` | Bewerkbaar structuurdiagram (nodes/edges/layout) |
| `src/lib/termsheet-extract.ts` | AI-extractie van invulvelden uit een geüploade PDF/HTML (Claude API) |
| `src/lib/docuseal.ts` | DocuSeal API-client: templates uit HTML/PDF, submissions zonder DocuSeal-mails, builder-JWT (HS256), rollen/auteur-lookup |
| `src/lib/mailer.ts` | Uitnodigingsmails: Microsoft Graph (client credentials, aanbevolen) met SMTP-terugval |
| `src/components/termsheet/` | Editor (rich text, undo/redo, clausulebeheer, "meer details"-pop-ups, verzendmodal), diagram, publieke leesweergave, vrij-document-editor |
| `src/app/ondertekenen/` | Pagina's: overzicht, editor, vrij document (ingebedde DocuSeal-veldeneditor), publieke ondertekenpagina `/ondertekenen/t/[token]` |
| `src/app/api/termsheets/` | REST-routes: CRUD, aanmaken vanuit upload/dossier, verzenden (incl. SMS-verificatie via `require_phone_2fa`), print-fallback, vrij-document-upload |
| `supabase/migration-termsheets.sql` | Tabel `term_sheets` |

## Benodigde omgeving

```
DOCUSEAL_URL=            # bv. https://sign.example.com — de eigen instantie
DOCUSEAL_API_TOKEN=      # {instantie}/settings/api — NIET de token van console.docuseal.com/.eu!
DOCUSEAL_ADMIN_EMAIL=    # bestaand account op de instantie (user_email in de builder-JWT)

# Uitnodigingsmails — optie 1 (aanbevolen): Microsoft Graph
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=     # app-registratie met Mail.Send (Application) + admin consent
SMTP_FROM=               # afzendermailbox

# Uitnodigingsmails — optie 2: klassiek SMTP
SMTP_HOST= / SMTP_PORT= / SMTP_USER= / SMTP_PASS=

ANTHROPIC_API_KEY=       # alleen nodig voor de AI-extractie bij PDF/HTML-upload
```

## Integratie-aandachtspunten

1. **App-afhankelijkheden.** De code verwijst naar twee interne modules die je
   in je eigen app moet voorzien of vervangen:
   - `@/lib/data` — `getStore()` met `listTermSheets/getTermSheet/createTermSheet/updateTermSheet/deleteTermSheet` (zie de migratie voor het datamodel);
   - `@/lib/auth` — `getCurrentUser()` en `canEdit(role)`.
2. **Publieke route.** Laat `/ondertekenen/t/` toe in je auth-middleware: de
   ondertekenpagina werkt met een lange token in de URL, zonder login.
3. **Embed-scripts van de eigen instantie laden.** De componenten laden
   `{DOCUSEAL_URL}/js/builder.js` en `/js/form.js`. Gebruik NIET
   `cdn.docuseal.com` — die build negeert `data-host` en praat dan met
   docuseal.com ("user_email doesn't exist").
4. **DocuSeal-mails staan uit** (`send_email: false`): de app mailt zelf een
   link naar de eigen interactieve ondertekenpagina waarin het
   DocuSeal-formulier is ingebed. Pro/EE-licentie vereist voor
   `/templates/html`, `/templates/pdf` en embedding; er is een gratis
   print-fallback met `{{...}}`-teksttags (`/api/termsheets/[id]/print`).
5. **SMS-verificatie.** Een ingevuld GSM-nummer bij een ondertekenaar wordt
   genormaliseerd naar E.164 en activeert `require_phone_2fa` op de submitter.
6. **React-valkuil.** `dangerouslySetInnerHTML`-objecten zijn overal
   gememoized: React vergelijkt `{__html}` op objectidentiteit; zonder memo
   wist elke re-render de (contenteditable) DOM.

## Tests

`src/lib/termsheet.test.ts` dekt de detailblok-parsing, de opbouw van de
Toelichting-bijlage en de teksttag-variant. Draaien met `npx vitest run`.
