import test from 'node:test'
import assert from 'node:assert/strict'

const source = await import('node:fs/promises')
const main = await source.readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const api = await source.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8')
const css = await source.readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

test('notifications center exposes notification categories and unread state', () => {
  assert.match(main, /NotificationsCenter/)
  assert.match(main, /notificationCount/)
  assert.match(main, /Unread/)
  assert.match(main, /All notifications/)
})

test('notifications center supports marking notifications read', () => {
  assert.match(main, /markNotificationRead/)
  assert.match(main, /markAllNotificationsRead/)
  assert.match(api, /markNotificationRead/)
  assert.match(api, /markAllNotificationsRead/)
})

test('notifications center supports care, payment, security and system routing', () => {
  assert.match(main, /Care/)
  assert.match(main, /Payments/)
  assert.match(main, /Security/)
  assert.match(main, /System/)
  assert.match(main, /setPage\(item\.page\)/)
})

test('notifications center has responsive styles', () => {
  assert.match(css, /notifications-center/)
  assert.match(css, /notification-filter/)
  assert.match(css, /notification-center-list/)
  assert.match(css, /@media\(max-width:720px\)/)
})
