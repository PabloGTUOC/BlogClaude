# ENDERTHOUGHTS // SYSTEM SETUP HANDBOOK

This manual describes how to initialize, configure, and boot the **enderthoughts** photo blog.

---

## 1. Firebase Authentication Setup

Enderthoughts uses Firebase Authentication for secure Google OAuth sign-in (this is the *app login*, separate from the Google Photos import OAuth in section 2).

### 1.1 Web App Client Keys
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (e.g. `enderthoughts`).
3. In the project dashboard, click the **Web icon** (`</>`) to add a Web App.
4. Name the app `enderthoughts-client`.
5. Copy the `firebaseConfig` keys into your `.env`:
   - `apiKey` &rarr; `VITE_FIREBASE_API_KEY`
   - `authDomain` &rarr; `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` &rarr; `VITE_FIREBASE_PROJECT_ID`
   - `appId` &rarr; `VITE_FIREBASE_APP_ID`
6. Under Build &rarr; **Authentication**, enable the **Google** sign-in provider. Add `localhost` and your production domain (e.g. `blog.enderthoughts.com`) to **Authorized Domains**.

### 1.2 Service Account Credentials (API Server)
1. In the Firebase Console, open **Project settings** (gear icon) &rarr; **Service accounts**.
2. Click **Generate new private key** and save the downloaded JSON somewhere safe.
3. Point `FIREBASE_SERVICE_ACCOUNT_PATH` in your `.env` at that file.

> The repo's `.gitignore` ignores `*-firebase-adminsdk-*.json`, so the downloaded key will not be committed.

---

## 2. Google Photos Picker API Setup

The digital galleries import photos/videos via the **Google Photos Picker API**
(`photospicker.googleapis.com`). The older Photos *Library* API is **deprecated for
new projects** and is not used.

The flow is server-driven: the app opens an OAuth popup &rarr; the backend exchanges the
code for a token &rarr; the backend creates a Picker session &rarr; the user selects media in
Google's own picker &rarr; the backend downloads the selected items.

### 2.1 Enable the API
1. Open the [Google Cloud Console](https://console.cloud.google.com/) and select your Firebase project.
2. In **APIs & Services &gt; Library**, search for **Photos Picker API** and **Enable** it.

### 2.2 OAuth Client ID + Secret
1. Go to **APIs & Services &gt; Credentials**.
2. Open the **OAuth 2.0 Client ID** (Firebase usually creates a "Web client" automatically).
3. Copy the **Client ID** &rarr; `VITE_GOOGLE_CLIENT_ID`.
4. Copy the **Client secret** &rarr; `GOOGLE_CLIENT_SECRET` (used server-side for the token exchange).

### 2.3 Register the Redirect URI ⚠️
Under the same OAuth client, add this **exact** value to **Authorized redirect URIs**:

```
<API_ORIGIN>/api/digital/google-photos/callback
```

- Local dev: `http://localhost:3000/api/digital/google-photos/callback`
- Production: `https://api.enderthoughts.com/api/digital/google-photos/callback`

`API_ORIGIN` must match this host in your `.env`. A mismatch causes `redirect_uri_mismatch`.

### 2.4 OAuth Consent Screen Scope
On the **OAuth consent screen**, add the scope:

```
https://www.googleapis.com/auth/photospicker.mediaitems.readonly
```

---

## 3. Environment Variables Configuration

Create a `.env` file in the project root and fill in every value:
```bash
cp .env.example .env
```

Key additions beyond the obvious DB/Firebase values:

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_SECRET` | Server-side OAuth token exchange for Google Photos |
| `API_ORIGIN` | Public base URL of the API; builds the OAuth redirect URI |
| `FRONTEND_ORIGIN` | Public base URL of the frontend (origin checks) |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID (used by **both** frontend and backend) |
| `UPLOAD_PATH` | Host directory for processed media (`full/`, `thumbs/`) |

`VITE_*` values are compiled **into** the frontend bundle at build time. In local dev they
are read from `.env` by Vite; in Docker they are passed as build args (handled automatically
by `docker-compose.yml` / `deploy.sh`).

---

## 4. Media Pipeline & Video Support

- **Images** are processed with `sharp` (resized full + thumbnail, EXIF extracted).
- **Videos** are stored as-is; a poster-frame thumbnail and duration/dimensions are produced
  with **ffmpeg**, provided by the bundled `ffmpeg-static` / `ffprobe-static` npm packages —
  **no system ffmpeg install is required**. The binaries download during `npm install`
  (so the Docker build needs internet access).
- Uploads accept `image/*` and `video/*`, up to **200&nbsp;MB** per file (multer limit).
- Both direct uploads and Google Photos imports support photos and videos.

> If you place the app behind a reverse proxy (e.g. nginx) in production, raise its
> `client_max_body_size` to at least `200m` so large video uploads aren't rejected.

---

## 5. Initial Bootstrap (Local Dev)

### 5.1 Run MySQL
```bash
docker compose up -d db
```

### 5.2 Start API Server
```bash
cd api
npm install
npm run dev
```
On boot the server auto-runs every SQL file in `db/migrations/` to create/upgrade tables.

### 5.3 Start Frontend (Vue + Vite)
```bash
cd ../frontend
npm install
npm run dev
```
Visit the local address shown in the terminal. Make sure `FRONTEND_ORIGIN` / `API_ORIGIN`
in `.env` match the ports you actually use.

---

## 6. Setting up the First Admin User

There is no self-registration path to Admin. Promote your user directly in MySQL:

1. Connect:
   ```bash
   docker exec -it enderthoughts-db mysql -u root -p enderthoughts
   ```
2. Find your user (after signing in once as a pending user):
   ```sql
   SELECT id, email, role, status FROM users;
   ```
3. Promote it:
   ```sql
   UPDATE users SET role='admin', status='approved' WHERE email='your-google-account@gmail.com';
   ```

---

## 7. Roles, Groups & Friend Access

Access is governed by three independent levers:

| Lever | Where set | Meaning |
|---|---|---|
| **role** | per user: `admin` / `family` / `friend` / `user` | Which tier the user is in |
| **group** | per user (a tag name, e.g. `berlin`) | Which friend circle they belong to |
| **gallery tags** | per analog gallery (e.g. `berlin`, `friends`) | Which circles may view that gallery |

**Tier rules:**
- **admin** — sees everything, including unpublished galleries; manages users & content.
- **family** — all *published* analog galleries **and** the full digital side.
- **friend** — **only** published analog galleries tagged with **their own group**. No digital access.
- **user** (legacy) — treated like family for analog viewing; no digital access.

**Friend access rule (analog):** a friend sees a published gallery **only if it carries a tag
matching their `group`**. The `friends` tag alone does **not** grant access — it's just a label.
A friend with **no group** assigned sees nothing.

**Admin workflow:**
1. Create the group/tag names (Admin &rarr; **Tag Manager**, or by tagging a gallery in
   **Analog Manager** — tags are global).
2. Assign a friend's group: Admin &rarr; **Users** &rarr; *Approved Directory* &rarr; `[ SET ROLE ]`
   &rarr; choose `friend` &rarr; pick **Group** (the dropdown is populated from existing tags) &rarr; Save.
3. Tag each analog gallery with the matching group name (e.g. `berlin`) and **publish** it.

> Each friend belongs to a single group. Multi-circle friends would require a `user_groups`
> junction table (not yet implemented).

---

## 8. Docker Compose Deployment (Production)

Prerequisites: Docker + Docker Compose installed, a fully filled `.env`, and the Firebase
service-account JSON present at `FIREBASE_SERVICE_ACCOUNT_PATH`.

```bash
./deploy.sh
```

`deploy.sh`:
- Validates that `.env` exists and required variables are set (including the `VITE_*`
  frontend build args — a missing one would silently bake a broken bundle).
- Ensures the host `UPLOAD_PATH` (with `full/`, `thumbs/`) exists.
- Builds the API and frontend images for **linux/amd64** (pinned in the Dockerfiles), passing
  `VITE_*` values as build args so they're baked into the frontend bundle.
- Runs `docker compose down` then `docker compose up -d`.
- The api waits for the MySQL healthcheck before starting; DB migrations then run
  automatically on API boot.

Default published ports:

| Service | Port |
|---|---|
| frontend (nginx) | `8080` |
| api | `3000` |
| db (mysql) | *not published* — reachable only by the api over the compose network |

### 8.1 Database users

The app never connects as MySQL `root`. Two credentials live in `.env`:

- `DB_PASS` — the container's root password (admin/backups only).
- `DB_USER` / `DB_APP_PASS` — the least-privilege account the API uses
  (granted on `DB_NAME` only). `DB_USER` must not be `root`.

On a **fresh** `mysql-data` volume the app user is created automatically
(`MYSQL_USER`/`MYSQL_PASSWORD` in compose). On an **existing** volume the mysql
image ignores those variables — create the user manually once:

```sql
CREATE USER IF NOT EXISTS 'enderthoughts'@'%' IDENTIFIED BY '<DB_APP_PASS>';
GRANT ALL PRIVILEGES ON enderthoughts.* TO 'enderthoughts'@'%';
FLUSH PRIVILEGES;
```

### 8.2 Runtime hardening (already wired in)

- api container runs as the non-root `node` user (uid 1000 — keep the host
  `UPLOAD_PATH` owned by the deploy user so it stays writable).
- api image has a `HEALTHCHECK` against `/health`.
- frontend nginx serves `index.html` with `no-cache` (hashed assets cache 1y),
  gzip, and `nosniff`/referrer-policy headers.

> For production, remember to set `API_ORIGIN` to your real API host and register the matching
> `…/api/digital/google-photos/callback` redirect URI in Google Cloud Console (section 2.3).
> Tail logs with `docker compose logs -f api`.

---

## 7. Backups

The family archive lives in exactly two places — the MySQL data volume and the uploads
directory. Neither survives a dead disk without backups. Minimum viable setup on the host:

```bash
# /etc/cron.d/enderthoughts-backup — daily at 03:30, keep 14 days
30 3 * * * root /srv/enderthoughts/backup.sh
```

`backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/srv/enderthoughts/backups
STAMP=$(date +%F)
mkdir -p "$BACKUP_DIR"

# 1. Database dump (through the running container; uses .env credentials)
docker exec enderthoughts-db sh -c 'exec mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

# 2. Uploads (originals + thumbnails; tmp/ is transient staging and excluded)
tar --exclude='tmp' -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_PATH")" "$(basename "$UPLOAD_PATH")"

# 3. Retention: drop anything older than 14 days
find "$BACKUP_DIR" -name '*.gz' -mtime +14 -delete
```

Copy the backup directory somewhere off the machine (rsync to another box, rclone to cloud
storage, or an external drive) — an on-host backup only protects against mistakes, not
hardware failure. Test a restore once: `gunzip < db-DATE.sql.gz | docker exec -i
enderthoughts-db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"` plus untarring
uploads back into `UPLOAD_PATH`.
