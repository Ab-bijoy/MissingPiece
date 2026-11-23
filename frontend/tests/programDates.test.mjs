import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptsApplications, dhakaToday, programEnded } from '../src/lib/programDates.ts'

test('Dhaka midnight changes the calendar date while UTC is still on the previous day', () => {
  assert.equal(dhakaToday(new Date('2030-11-23T17:59:59Z')), '2030-11-23')
  assert.equal(dhakaToday(new Date('2030-11-23T18:00:00Z')), '2030-11-24')
  assert.equal(dhakaToday(new Date('2030-11-23T23:59:59Z')), '2030-11-24')
  assert.equal(dhakaToday(new Date('2030-12-31T18:00:00Z')), '2031-01-01')
})

test('past and complete programs cannot accept applications; same-day live programs can', () => {
  const today = dhakaToday(new Date('2030-11-23T18:30:00Z'))
  const past = { status: 'live', event_date: '2030-11-23' }
  assert.equal(programEnded(past, today), true)
  assert.equal(acceptsApplications(past, today), false)
  assert.equal(acceptsApplications({ status: 'live', event_date: today }, today), true)
  assert.equal(acceptsApplications({ status: 'complete', event_date: today }, today), false)
  assert.equal(acceptsApplications({ status: 'draft', event_date: today }, today), false)
})
