// The meal "phase" is worked out from the DATABASE clock (now()), never from the browser's clock.
// Cut-off passed -> LOCKED, meal started -> SERVING, meal ended -> CLOSED.
// It is computed on every request, so it is correct even if the scheduler is a bit late.
const phase = (alias = 's') => `(CASE
  WHEN now() < ${alias}.cutoff_at THEN 'OPEN'
  WHEN now() < ${alias}.starts_at THEN 'LOCKED'
  WHEN now() < ${alias}.ends_at   THEN 'SERVING'
  ELSE 'CLOSED' END)`;

// "Today" in Indian time, as a date
const TODAY_IST = `(now() AT TIME ZONE 'Asia/Kolkata')::date`;

module.exports = { phase, TODAY_IST };
