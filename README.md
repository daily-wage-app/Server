# Daily Wage Server · Admin

Static GitHub Pages admin dashboard for profiles submitted from `daily-wage-app/Home`.

## Current architecture

- Firebase project: `daily-29af6`
- Firestore database: `(default)`, Singapore region (`asia-southeast1`)
- Collection/document: `userProfiles/{anonymousAuthUid}`
- Worker: Firebase Anonymous sign-in; can create, update, and read only their own profile
- Admin: verified Google account `dailywage172@gmail.com`; can query and read all profiles
- Firebase web configuration is public client metadata; user records are stored in Firestore, **not in Git**
- GitHub Pages: <https://daily-wage-app.github.io/Server/> (main branch, repository root)

## Firebase setup status

The default Firestore database has been provisioned in Singapore. Anonymous and Google sign-in providers are enabled. Google sign-in uses the public-facing project name `Daily Wage` and support email `dailywage172@gmail.com`. The authorized Firebase Auth domain `daily-wage-app.github.io` has been added for both Home and Server Pages. The reviewed rules in `firestore.rules` have been published to the default database.

For future rule changes, authenticate with the Firebase CLI and run `firebase deploy --only firestore --project daily-29af6` from this repository. `firebase.json` uses the documented single-database configuration for the project's default Firestore database.

## Page behavior and access control

The dashboard signs in with Google, checks for the verified administrator email, queries profiles ordered by last update, and provides in-memory search. Firestore Security Rules enforce the same admin boundary on database reads; hiding the page alone is not the security control. No delete or bulk-export action is provided.

The rules validate allowed fields and types, require consent metadata, restrict each worker to their own UID document, allow list/read-all only for the verified admin account, and deny deletes. Do not replace them with public `allow read, write: if true` rules.

## Privacy and rollout

Names, dates of birth, country, gender, phone, and email are sensitive personal data. Limit access to necessary administrators, retain it only as long as required, and honor applicable notice, consent, and deletion obligations. Anonymous sign-in provides a scoped UID, not proof of real-world identity. Before broad public use, configure Firebase App Check/reCAPTCHA, publish a privacy policy, establish retention/deletion procedures, and monitor Firebase quotas. Never put a Firebase Admin SDK service-account key in this static site or Git repository.

Client SDK imports are pinned to Firebase JavaScript SDK `12.19.0` via Google's CDN.
