# Local Event Engagement Verification

## Checks

- Include `local-event.css` and `local-event-note.js` on a test page.
- Click `Se event her`.
- Verify modal opens on desktop and mobile width.
- Verify one `responseType:"click"` document is created once per browser/note.
- Click `Nej` and verify one `local_event_responses` document is created with `attending:false`.
- Reopen and click `Ja`.
- Verify competition form is shown.
- Try submitting without terms accepted and verify it is blocked.
- Submit with name, contact, share text, and terms accepted.
- Verify Firestore document has:
  - `noteId`
  - `eventId`
  - `restaurantId`
  - `userName`
  - `contact`
  - `attending:true`
  - `shareWithText`
  - `competitionOptIn:true`
  - `sourceModule`
  - `createdAt`
- Close modal and verify dismiss is stored in localStorage.
- Include `local-event-admin.js` and verify counts plus CSV export.

## Syntax

```bash
node --check public/modules/local-events/local-event-modal.js
node --check public/modules/local-events/local-event-note.js
node --check public/modules/local-events/local-event-admin.js
```
