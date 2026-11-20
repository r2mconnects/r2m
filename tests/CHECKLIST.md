# R2M CONNECT — manual test checklist

## Auth
- [ ] /setup creates the Main Admin once; afterwards /setup redirects to /login
- [ ] Login with mobile and with email; 5 wrong passwords lock for 15 min
- [ ] Forgot password notifies admin; admin generates reset link; link works once
- [ ] Suspended user cannot log in; existing sessions are revoked
## Membership
- [ ] Register (mobile, photo, ID) → appears under Admin → Applications (Pending)
- [ ] Pre-approve → member sees Pay prompt (Razorpay if configured, else manual)
- [ ] Agent records collection; a *different* finance user verifies → receipt generated
- [ ] Approve is blocked until fee verified (when fee > 0); approval generates R2M-000001
- [ ] Card shows real data; Download PDF / Print / Share work; /verify/<token> shows status; Reissue invalidates old QR
- [ ] Suspend → card & verify page show Suspended; Reactivate
- [ ] Renewal (online or manual) extends validity; expired members become Expired
## Permissions
- [ ] District president sees only own district members/applications/staff
- [ ] Agent cannot approve own registration; cannot open /admin/settings (→ /unauthorized)
- [ ] Welfare officer cannot approve/disburse unless granted
## Shop
- [ ] Product with images/stock; cart quantities limited to stock; coupon works
- [ ] Double-submitting checkout creates one order; stock deducted once at payment/COD
- [ ] Cancel restores stock; refund records; invoice shows GST breakup
## Welfare
- [ ] Apply → review levels → committee approve → (different user) disburse
## Content & other
- [ ] News audience targeting & scheduling; events registration & attendance export
- [ ] SOS submit → acknowledge; blood donor consent; mechanic directory only verified opt-ins
- [ ] Telugu language switch in Member → Settings
- [ ] Mobile: bottom nav, drawer; Desktop: header nav + admin sidebar
