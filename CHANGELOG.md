# 0.2.0

- [NEW] Creating a subscription automatically tracks the record in Authorize.net using Sequelize hooks
- [FIX] Issue with seeing subscriptions on users after signup

# 0.1.0

- [EDIT] Removed penalties table

- [NEW] Payment profiles table to track primary account payer in family of members

- [EDIT] Removed the following columns from `users` table:

  - authorizeId
  - paymentId
  - payingMember

- [EDIT `accountHolder` is now a computed property on `users` based on if there is a matching `paymentProfile` record where they are listed as the primary

- [EDIT] `subscriptions` now tracks a record from `paymentProfiles`.

- [EDIT] Removed unnecessary columns in subscriptions table:

  - paidAt
  - monthly
  - yearly
  - chargeID

- [EDIT] Renamed `total` to be `amount` on `subscriptions`

- [EDIT] `subscriptions` now track a new column named `type` to determine what kind of subscription it is. (Beneficial for custom subscriptions in the future)

- [EDIT] `sunscriptions` no longer track timestamps on creation, rather track a pointer to Authorize.net

# 0.0.0

- initial creation of changelog file
