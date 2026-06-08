# ENDERTHOUGHTS // SYSTEM SETUP HANDBOOK

This manual describes how to initialize, configure, and boot the **enderthoughts** photo blog.

---

## 1. Firebase Authentication Setup

Enderthoughts uses Firebase Authentication for secure Google OAuth sign-in.

### 1.1 Web App Client Keys
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project called `enderthoughts`.
3. In the project dashboard, click the **Web icon** (`</>`) to add a Web App.
4. Name the app `enderthoughts-client`.
5. Copy the `firebaseConfig` object keys from the setup screen. You will place these into your `.env`:
   - `apiKey` &rarr; `VITE_FIREBASE_API_KEY`
   - `authDomain` &rarr; `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` &rarr; `VITE_FIREBASE_PROJECT_ID`
   - `appId` &rarr; `VITE_FIREBASE_APP_ID`
6. In the left sidebar under Build, click **Authentication** and enable **Google** sign-in provider. Add `localhost` and your production domain `blog.enderthoughts.com` to Authorized Domains.

### 1.2 Service Account Credentials (API Server)
1. In the Firebase Console, click the **Settings Gear** next to "Project Overview" and choose **Project settings**.
2. Navigate to the **Service accounts** tab.
3. Click **Generate new private key**.
4. Save the downloaded JSON file to a secure directory (e.g., `/Users/pablogtorres/Desktop/Projects/BlogClaude/firebase-service-account.json`).
5. Update `FIREBASE_SERVICE_ACCOUNT_PATH` in your `.env` to point to this file path.

---

## 2. Google Photos Picker API Setup

To enable digital timeline cloud imports:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Firebase project from the dropdown.
3. Search for and enable the **Photos Picker API** (and/or **Google Photos Library API**).
4. Go to **APIs & Services &gt; Credentials**.
5. Locate the **OAuth 2.0 Client IDs** automatically created by Firebase.
6. Click edit and copy the **Client ID**.
7. Update `VITE_GOOGLE_CLIENT_ID` in your `.env`.

---

## 3. Environment Variables Configuration

Create a `.env` file in the project root:
```bash
cp .env.example .env
```
Fill out all credentials. In local dev, you can leave Firebase keys empty to run in **Mock Auth Mode**.

---

## 4. Initial Bootstrap (Local Dev)

You can run the stack locally for development using node processes:

### 4.1 Run MySQL Database
Start a local MySQL server instance (or run the compose `db` service only):
```bash
docker compose up -d db
```

### 4.2 Start API Server
```bash
cd api
npm install
npm run dev
```
On boot, the server will detect and automatically execute all SQL migration files in `db/migrations/` to initialize tables.

### 4.3 Start Frontend Vue App
```bash
cd ../frontend
npm install
npm run dev
```
Visit the local server address shown in the terminal.

---

## 5. Setting up the First Admin User

There is no self-registration path to the Admin role. You must promote your user directly in MySQL:

1. Connect to your MySQL database:
   ```bash
   docker exec -it enderthoughts-db mysql -u root -p enderthoughts
   ```
2. Retrieve your user registration (after signing in for the first time as pending):
   ```sql
   SELECT id, email, role, status FROM users;
   ```
3. Set your role to `'admin'` and status to `'approved'`:
   ```sql
   UPDATE users SET role='admin', status='approved' WHERE email='your-google-account@gmail.com';
   ```

*(Alternatively, you can run this INSERT statement pre-emptively if you already know your Google Firebase UID)*:
```sql
INSERT INTO users (firebase_uid, email, name, role, status) 
VALUES ('YOUR_FIREBASE_UID_HERE', 'pablo@enderthoughts.com', 'PABLO', 'admin', 'approved');
```

---

## 6. Docker Compose Deployment (Production)

To compile and launch the production containers targeted for target platform x86_64:

```bash
./deploy.sh
```
This compile utility:
- Builds images target platform `linux/amd64`
- Runs `docker compose down` to clear old contexts
- Launches `docker compose up -d`
- Automatically mounts the host upload directory to keep processing output folders persistent.
