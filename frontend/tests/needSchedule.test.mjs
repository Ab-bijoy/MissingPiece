import assert from 'node:assert/strict'
import test from 'node:test'
import { scheduleIssue, toDhakaInput, fromDhakaInput } from '../src/lib/needSchedule.ts'

test('missing, invalid, reversed and expired schedules are unavailable', () => {
  const now = Date.parse('2030-11-24T00:00:00Z')
  assert.equal(scheduleIssue(null, null, now), 'missing')
  assert.equal(scheduleIssue('2030-11-25T10:00:00+06:00', null, now), 'missing')
  assert.equal(scheduleIssue('bad', 'bad', now), 'invalid')
  assert.equal(scheduleIssue('2030-11-25T12:00:00+06:00', '2030-11-25T10:00:00+06:00', now), 'invalid')
  assert.equal(scheduleIssue('2030-11-23T10:00:00+06:00', '2030-11-23T12:00:00+06:00', now), 'ended')
  assert.equal(scheduleIssue('2030-11-25T22:00:00+06:00', '2030-11-26T02:00:00+06:00', now), null)
})

test('editing UTC timestamps preserves the original Bangladesh time and instant', () => {
  assert.equal(toDhakaInput('2030-11-25T04:30:00Z'), '2030-11-25T10:30')
  assert.equal(toDhakaInput('2030-11-25T18:30:00Z'), '2030-11-26T00:30')
  assert.equal(Date.parse(fromDhakaInput(toDhakaInput('2030-11-25T04:30:00Z'))), Date.parse('2030-11-25T04:30:00Z'))
  assert.equal(toDhakaInput(null), '')
})
