# vue-express-fullstack-auth-i18n-template

A **full-stack starter** with **Vue 3 (Vite)** on the client and **Express.js** on the server.  
Includes authentication, profile editing with **Google Maps** integration, and **multi-language** support (English + French) via Vue I18n.

---

## ✨ Features

### Client (Vue 3 + Vite)
- Login / Signup / Logout flows
- Profile editor with:
  - Google Maps (Advanced Marker + Map ID)
  - Radius selection with PostGIS-compatible units
  - Place Autocomplete
  - Geocoding
- Language picker (FR/EN) with i18n-backed validation
- Accessible navbar & dropdown menus

### Server (Express)
- API routes:
  - `GET /api/profile` – fetch profile
  - `PUT /api/profile` – update profile
- CORS ready for local dev
- Easily extendable for real authentication & databases

### Database (Postgres + PostGIS)
- `User` table schema with:
  - UUID primary key
  - Email & social login IDs
  - PostGIS `geography` location column
  - GiST spatial index for geo queries

---

## 📂 Project Structure

```
/client
  /src
    /components
    /composables
    /router
    /utils
    /views
  vite.config.js
  .env

/server
  /routes
  /db
  /services
  /utils
  server.js
  schema.sql
  .env

README.md
```

---

## 🚀 Getting Started

### 1) Clone the template

On GitHub: **Use this template** → create a new repository.  
Or via CLI:

```bash
npx degit yourname/vue-express-fullstack-auth-i18n-template my-app
cd my-app
```

---

### 2) Environment Variables

Copy and edit:

```bash
# client
cp client/.env.example client/.env

# server
cp server/.env.example server/.env
```

**`client/.env`**
```env
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_MAP_API=YOUR_GOOGLE_MAPS_API_KEY
VITE_GOOGLE_MAP_ID=YOUR_GOOGLE_MAP_ID
etc...
```
> **Map ID** is created in Google Cloud → Maps Platform → Map Management.

**`server/.env`**
```env
PORT=4000
ORIGIN=http://localhost:5173
DATABASE_URL=postgres://user:pass@localhost:5432/app
JWT_SECRET=change-me
etc...
```

---

### 3) Install & Run

**Option A — Workspaces**
```bash
npm install
npm run start -w server
npm run dev -w client
```

**Option B — Separate installs**
```bash
cd server && npm install && npm run dev
# new terminal
cd client && npm install && npm run dev
```

---

## 🗺 Google Maps Setup

- Loads with `v=weekly&loading=async` and `importLibrary` API
- Uses **AdvancedMarkerElement** (requires `VITE_GOOGLE_MAP_ID`)
- Place autocomplete uses modern API, falls back for older accounts

---

## 🗄 Database

Example schema (`server/schema.sql`):

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE "public"."User" (
  "id" uuid NOT NULL,
  "email" varchar(255),
  "displayName" varchar(255),
  "password" varchar(255),
  "googleId" varchar(255),
  "facebookId" varchar(255),
  "isVerified" bool DEFAULT false,
  "createdAt" timestamptz DEFAULT now(),
  "location" geography,
  "search_radius_m" int4,
  "base_address" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON public."User" (email);
CREATE UNIQUE INDEX "User_googleId_key" ON public."User" ("googleId");
CREATE UNIQUE INDEX "User_facebookId_key" ON public."User" ("facebookId");
CREATE INDEX users_location_gix ON public."User" USING gist (location);
```

---

## 📦 Production

### Client
```bash
cd client
npm run build
```

### Server
- Use real authentication (JWT/session)
- Deploy behind HTTPS with correct `ORIGIN`
- Connect to a managed Postgres + PostGIS

---

## 🛠 Customization Ideas
- Add OAuth providers (GitHub, Apple)
- Use Prisma, Drizzle, or Knex for migrations
- Add Helmet and stricter validation
- Write tests with Vitest & Vue Test Utils (client) + Supertest (server)

---

## ⚠ Troubleshooting

- **Maps not loading** → Check API key, billing, adblockers, CSP
- **Advanced markers warning** → Ensure `VITE_GOOGLE_MAP_ID` is correct
- **Validation in wrong language** → Uses custom i18n validation to override browser defaults

---

## 📄 License
MIT — free to use, modify, and distribute.