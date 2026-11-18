# Security Specification: EquipStock Pro Firestore Rules

## 1. Data Invariants
- Unauthenticated access is denied across all collections.
- Only verified users (`request.auth.token.email_verified == true` or admin) can read and write business data.
- Admins (`isAdmin()`) can access all resources.
- `createdAt` timestamps cannot be changed once created.
- Negative stock quantities are forbidden in warehouse stocks.
- Sales marked as `CANCELLED` cannot have arbitrary status reversions.
- Document IDs must conform to alphanumeric and hyphen/underscore pattern (`^[a-zA-Z0-9_\-]+$`) with length `<= 128`.

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read on Articles**: Reading `/articles/{articleId}` without `request.auth`.
2. **Unauthenticated Write on Sales**: Inserting a sale record with `request.auth == null`.
3. **ID Poisoning**: Writing a document with a 2000-character malicious path ID `/articles/{junkId}`.
4. **Self-Promotion to Admin**: A non-admin user creating a document in `/admins/{uid}` with their own UID.
5. **Shadow Field Injection**: Adding `{ "isSuperAdmin": true }` into an article document update.
6. **Negative Quantity Stock**: Injecting a stock record with `quantity: -9999`.
7. **Created Date Tampering**: Updating an article or sale to change `createdAt`.
8. **Cash Register Bypass**: Modifying a closed cash session's `status` to `OPEN` without admin privilege.
9. **Blanket Query Scraping**: Malicious user running an open query on other users' private profiles without ownership.
10. **Orphaned Movement**: Creating a stock movement without referencing a valid article ID.
11. **Price Manipulation in Verified Sale**: Directly editing line totals of a confirmed sale.
12. **Unauthorized Role Modification**: Normal user changing their own role in `/users/{userId}` from `MAGASINIER` to `ADMIN`.
