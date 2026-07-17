# Sheep Tracker

A small, no-frills sheep-tracking web app for a single farm. Track animals and
their lineage over time — add, edit, delete, search, view an animal's lambs, and
walk its ancestry up the mother line. Built to run entirely within AWS
always-free usage for a single farmer managing a flock of tens to low hundreds
of animals.

- **Infrastructure**: SST v3 (ion), deployed to AWS
- **API**: AWS Lambda behind API Gateway V2
- **Data**: DynamoDB single table, on-demand billing (AWS SDK v3 Document client)
- **Frontend**: Vue 3 + Vite + Tailwind CSS, served as an S3 + CloudFront static site
- **Auth**: `@alistairmross/auth`, email + password login with a `roles` claim
- **Excel export**: client-side via SheetJS (`xlsx`)

## Repository layout

```
sst.config.ts            Infrastructure (table, API, routes, static site, auth)
auth.ts                  Auth module configuration
packages/core            Shared Animal types used by backend and frontend
packages/functions       Lambda handlers + DynamoDB data-access layer
packages/web             Vue 3 frontend
scripts/seed.ts          Optional demo seed data
```

## Prerequisites

- **Node.js 22+**
- **Yarn 4.9.2** (the repo pins `packageManager: yarn@4.9.2`)
- **AWS account + credentials** configured locally (e.g. `AWS_PROFILE` or
  `~/.aws/credentials`) with permission to deploy SST resources
- **SST v3** (installed as a dev dependency; no global install required)

## Install

```bash
yarn install
```

## Authentication

Auth is provided by the `@alistairmross/auth` module and configured in
[`auth.ts`](./auth.ts), which is imported by `sst.config.ts`. The bundled auth
documentation (`authReadme.md`) refers to the package as `@fluss/auth` — that is
a placeholder; the actual published, installed package is `@alistairmross/auth`,
and `auth.ts` imports from `@alistairmross/auth/infrastructure`.

`auth.ts` calls `createAuthModule(...)` with:

- **JWT** — 1h access token, 365d refresh token
- **Email (SES)** — `fromAddress` used for password-reset emails
- **Password** — enables the email + password routes (`POST /auth/password/login`,
  `PUT /auth/password`, `POST /auth/password/forgot`, `POST /auth/password/reset`)
- **CORS** — restricted to the configured allowed origins

The module deploys its own API Gateway, DynamoDB table, and a Lambda **JWT
authorizer**. `sst.config.ts` attaches that authorizer to every `/animals`
route, so the authorizer injects `userId` and a JSON-stringified `roles` array
into each request's context. The backend reads these in
`packages/functions/src/lib/auth.ts` to enforce the admin gate server-side.

### SES sandbox note

New AWS accounts have Amazon SES in **sandbox mode**, where both sender and
recipient email addresses must be verified before mail is sent. Verify the
`EMAIL_FROM_ADDRESS` (and any recipient you test password resets against):

```bash
aws ses verify-email-identity --email-address <address> --region <region>
```

Set the real sender by editing `EMAIL_FROM_ADDRESS` in `sst.config.ts`.

## Run locally

```bash
yarn dev
```

This runs `sst dev`, which provisions the backend in your AWS account and starts
the Vite dev server. The web app is served at **http://localhost:5173** and is
wired to the deployed API and auth endpoints via the `VITE_API_URL` and
`VITE_AUTH_API_URL` environment variables that SST injects.

## Deploy

```bash
yarn deploy
```

This runs `sst deploy`. Add the production web origin to `PRODUCTION_ORIGINS` in
`sst.config.ts` before deploying so CORS on both the app API and the auth API
allows it. Outputs include the API URL, the auth API URL, and the web URL.

## Granting a user the `admin` role

The app requires the `admin` role. An authenticated user **without** `admin`
sees only a "please contact an admin" page, and every API endpoint rejects
non-admin and unauthenticated requests server-side.

New users default to no roles, so an admin must be provisioned directly against
the auth module's DynamoDB table:

1. **Provision the admin user with a password.** The simplest path is the auth
   module's internal `migrationFunction`, invoked with the AWS SDK, passing
   `roles: ['admin']` and either a bcrypt `passwordHash` or no password.
   Alternatively, create the user and set roles, then set an initial password
   via the forgot/reset flow:
   - `POST /auth/password/forgot` with `{ "email": "farmer@example.com" }`
     (emails a reset token — or returns it directly if no SES sender is set)
   - `POST /auth/password/reset` with the token and the new password
2. **Ensure `roles` contains `admin`.** If the user record's `roles` attribute
   does not already include `admin`, set it on the user item in the auth
   DynamoDB table (e.g. `roles: ["admin"]`).

Once the user has a password and the `admin` role, they log in on the app's
login page with their email and password.

## Data model

Each animal (a "lamb" and a "sheep" are the same entity) has: `id` (farmer's tag
number, unique, primary identifier), `colour`, `sex` (`ewe` | `ram` | `wether`),
optional `breed`, optional `dob`, optional `motherId`, optional `fatherId`,
`status` (`alive` | `sold` | `deceased`, default `alive`), optional `notes`, and
`createdAt` / `updatedAt` timestamps.

### DynamoDB single-table design

Table `SheepTracker`, keys `pk` / `sk`, on-demand billing:

- **Animal item**: `pk = ANIMAL#<id>`, `sk = ANIMAL#<id>`
- **GSI1** (list all, sorted): `gsi1pk = "ALL#ANIMAL"`, `gsi1sk = <id zero-padded>`
- **GSI2** (lambs by mother, only when `motherId` is set): `gsi2pk = MOTHER#<motherId>`,
  `gsi2sk = ANIMAL#<id>`

Lineage is resolved by walking `motherId` upward with sequential gets, capped at
a fixed depth to avoid runaway loops.

## API

All endpoints require an authenticated `admin` and return a consistent JSON error
shape (`{ "error": { "code", "message" } }`) with explicit `400` / `401` / `403`
/ `404` / `409` statuses.

| Method | Path | Description |
|---|---|---|
| GET | `/animals` | List all (GSI1); optional `status` and free-text `q` filters |
| GET | `/animals/{id}` | One animal, including its lambs and lineage chain |
| POST | `/animals` | Create (with validation) |
| PUT | `/animals/{id}` | Update |
| DELETE | `/animals/{id}` | Delete (see behavior below) |
| GET | `/animals/{id}/lambs` | Direct lambs (GSI2) |
| GET | `/animals/{id}/lineage` | Ancestry up the mother line |

Validation: `id` is required and unique; a `motherId` / `fatherId` that does not
reference an existing animal is rejected; an animal cannot be its own
mother/father; and cycles in the mother chain are rejected on update.

### Delete behavior

Deleting an animal that still has lambs is **rejected** with `409 CONFLICT`. The
app does not silently orphan lambs — reassign or remove an animal's lambs before
deleting it.

## Excel export

The animals list has an **Export to Excel** button that generates an `.xlsx`
**client-side** with SheetJS from exactly the rows currently shown — it honors
the active search and status filters. Columns: ID, Colour, Sex, Breed, DOB,
Mother tag, Father tag, Status, Lamb count, Notes. The filename includes the date
and a hint of the active filter (e.g. `sheep-tracker-alive-2026-07-16.xlsx`). The
button is disabled when the filtered result set is empty. The export mapping
lives in `packages/web/src/lib/export.ts` and is covered by a unit test.

## Seed data (optional)

```bash
yarn seed
```

Runs `sst shell tsx scripts/seed.ts`, inserting a handful of example animals with
a mother/lamb chain (a matriarch, a daughter, and her lambs) so the lineage and
lambs views have something to show.

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | `sst dev` — backend + Vite dev server |
| `yarn deploy` | `sst deploy` |
| `yarn typecheck` | Type-check all workspaces |
| `yarn typecheck:infra` | Type-check `sst.config.ts` / `auth.ts` |
| `yarn lint` | ESLint over the repo |
| `yarn test` | Backend (Vitest + `aws-sdk-client-mock`) and web unit tests |
| `yarn build` | Build the web app |
| `yarn seed` | Seed demo data |

## Cost — AWS always-free

At this scale (a single user, a flock of tens to low hundreds of animals) the
deployed resources stay within AWS always-free usage:

- **DynamoDB** is on-demand (no provisioned capacity); a single small table with
  two GSIs and low traffic stays within the always-free storage and request
  allowances.
- **Lambda** is serverless and scales to zero; the request/compute volume is far
  below the always-free monthly grant.
- The **static site** is S3 + CloudFront within free-tier limits for low traffic.
- There is **no RDS, no Aurora, and no NAT Gateway**; Lambdas are not placed in a
  VPC that would require an hourly-billed NAT Gateway. Nothing is always-on.
