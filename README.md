# Daily Wage Server · Admin

Static GitHub Pages admin dashboard for profile records and TrueMoney withdrawal requests. The administrator profile directory and payout queue are presented in Burmese. **This repository is a static admin UI, not a payment-processing backend.** User records, reward wallets, and withdrawal requests live in Firestore, never in Git.

## Current architecture

- Firebase project: `daily-29af6`
- Firestore database: `(default)`, Singapore region (`asia-southeast1`)
- Worker authentication: Firebase Anonymous sign-in
- Administrator: verified Google account `dailywage172@gmail.com`
- GitHub Pages: <https://daily-wage-app.github.io/Server/> (main branch, repository root)
- Firebase web configuration is public client metadata; never add a service-account key here.

## Reward and withdrawal data

- `userProfiles/{uid}` — profile details; only the owner can read/write their profile, and only the verified admin can list profiles.
- `rewardWallets/{uid}` — points and last check-in/withdrawal timestamps; the owner can read it, the app can only make rules-validated reward/withdrawal transitions, and the admin can read a single wallet only when refunding a rejected request. Wallet collection listing is denied.
- `withdrawalRequests/{requestId}` — amount, points, TrueMoney account holder name/number, status, consent version, timestamps, and admin note. A worker can query only their own requests; the admin can review the queue.

The app awards 1,000 points for seven consecutive **Asia/Bangkok calendar days**, at 100 points per THB. The minimum is 10 THB (1,000 points), and a user may request one withdrawal per Bangkok calendar day. User wallet balance reduction and request creation occur in one Firestore transaction. Admin transitions are `pending → processing → paid` or `pending/processing → rejected`; rejection refunds points in the same transaction and requires a reason.

The dashboard shows a 24-hour target/overdue indicator. An admin must review and send the TrueMoney payment manually outside this website, then mark the request `paid`. The page does **not** initiate or guarantee a transfer. Account numbers are masked until an authorized administrator chooses to reveal them.

## Firestore rules deployment

`firestore.rules` contains the authorization and validation required for the feature. The feature will not work until the Firebase project owner reviews and deploys the updated rules. From this repository, the owner can use:

```sh
firebase deploy --only firestore --project daily-29af6
```

The rule set preserves the existing profile permissions, validates wallet transitions using server `request.time`, compares calendar days in Bangkok by applying UTC+7 before extracting the date, and uses `getAfter()` so point debits/refunds and request status writes must be atomic. Do not replace these rules with public access rules.

## Privacy and rollout

TrueMoney wallet details are sensitive financial data. Limit access to the verified administrator, avoid unnecessary exports, establish retention/deletion procedures, and publish a privacy notice. Anonymous sign-in is not identity verification and can be lost with browser data; multiple anonymous accounts may also abuse cash-equivalent rewards. For public payout use, configure durable verified worker sign-in, Firebase App Check, and an anti-abuse policy. This app does not use a TrueMoney API or automatically move funds.
