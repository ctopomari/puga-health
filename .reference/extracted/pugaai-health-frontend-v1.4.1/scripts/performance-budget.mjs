import { existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')
if (!existsSync(dist)) {
  console.log('Performance budget pending: dist/ does not exist. Run `npm run build` first.')
  process.exit(0)
}
const MAX_JS = 650 * 1024
const MAX_CSS = 220 * 1024
let js = 0, css = 0
for (const file of readdirSync(dist, { recursive: true })) {
  const path = join(dist, file)
  if (!statSync(path).isFile()) continue
  const size = statSync(path).size
  if (/\.js$/i.test(file)) js += size
  if (/\.css$/i.test(file)) css += size
}
console.log(`JS bundle: ${js} bytes (budget ${MAX_JS})`)
console.log(`CSS bundle: ${css} bytes (budget ${MAX_CSS})`)
if (js > MAX_JS || css > MAX_CSS) process.exit(1)
console.log('Performance budget passed.')
