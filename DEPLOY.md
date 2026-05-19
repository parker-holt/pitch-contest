# Deploy Guide — Firebase version

## Step 1 — Firebase Admin key (3 min)

You need a service account key for the server-side API routes:

1. Firebase Console → Project Settings (gear icon)
2. **Service accounts** tab
3. Click **Generate new private key** → download the JSON file
4. Open the JSON and copy these 3 values:
   - `project_id` → FIREBASE_PROJECT_ID
   - `client_email` → FIREBASE_CLIENT_EMAIL  
   - `private_key` → FIREBASE_PRIVATE_KEY (the whole thing including -----BEGIN/END-----)

## Step 2 — Anthropic API key (2 min)

console.anthropic.com → API Keys → Create → copy it

## Step 3 — Deploy to Vercel (5 min)

```bash
cd pitch-app-firebase
npx vercel --prod
```

Add these environment variables when prompted (or in Vercel dashboard → Settings → Environment Variables):

```
# Firebase browser keys (already filled in from your config)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB-7SAIc_lP304WO6xsaUwYpnvlKCmfvnU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=trurisk-pitch-demo-contest.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=trurisk-pitch-demo-contest
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=trurisk-pitch-demo-contest.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=499250974908
NEXT_PUBLIC_FIREBASE_APP_ID=1:499250974908:web:067ac677eea8163fa580b9

# Firebase Admin (from service account JSON)
FIREBASE_PROJECT_ID=trurisk-pitch-demo-contest
FIREBASE_CLIENT_EMAIL=<from JSON>
FIREBASE_PRIVATE_KEY=<from JSON — paste the whole key with \n newlines>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_CONTEST_NAME=TruRisk Pitch & Demo Contest
```

## Step 4 — Seed the database

Once deployed, visit:
```
https://your-app.vercel.app/api/contest
```

This auto-creates your contest + 5 judge accounts with unique tokens.

## Step 5 — Get judge links

Go to:
```
https://your-app.vercel.app/admin
```

All 5 judge links are listed — copy and send one to each judge.

## Step 6 — Firestore security rules

In Firebase Console → Firestore → Rules, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for leaderboard
    match /submissions/{id} {
      allow read: if true;
      allow write: if false; // only server writes via Admin SDK
    }
    match /contests/{id} {
      allow read: if true;
      allow write: if false;
    }
    // No client access to scores/judges — server only
    match /scores/{id}   { allow read, write: if false; }
    match /judges/{id}   { allow read, write: if false; }
  }
}
```

## Running locally

```bash
cp .env.local.example .env.local
# fill in your keys
npm install
npm run dev
# open http://localhost:3000
```
