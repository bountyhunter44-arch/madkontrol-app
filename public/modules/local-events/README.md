# Local Event Engagement

Phase 1 provides a small reusable event note and engagement modal.

## Include

```html
<link rel="stylesheet" href="/modules/local-events/local-event.css">
<script type="module" src="/modules/local-events/local-event-note.js"></script>
```

## Note markup

```html
<button
  data-local-event-note
  data-note-id="note_123"
  data-event-id="event_123"
  data-restaurant-id="company_123"
  data-company-id="company_123"
  data-location-id="location_123"
  data-restaurant-name="Cafe Victoria"
  data-title="Pizzaaften på torvet"
  data-starts-at="Fredag kl. 18"
  data-place="Torvet 12"
  data-summary="Kom forbi til lokal event og smagsprøver."
>
  Se event her
</button>
```

## Admin panel

```html
<link rel="stylesheet" href="/modules/local-events/local-event.css">
<script type="module" src="/modules/local-events/local-event-admin.js"></script>
<div data-local-event-admin data-company-id="company_123" data-location-id="location_123"></div>
```

## Data

Responses are saved in `local_event_responses`.

Opening the modal records a lightweight `responseType:"click"` document once per browser/note so restaurants can see click volume. Attendance and competition submissions use `responseType:"attendance"`.

Competition contact data is only for the competition unless separate consent is collected elsewhere.
