import {readFileSync,existsSync} from 'node:fs'
import {validateReleaseConfig} from '../src/services/release-preflight.js'
const file=process.env.RELEASE_ENV_FILE || '.env.production'
if(!existsSync(file)){console.log(`No ${file} found. Configuration cannot be certified until deployment values are supplied.`);process.exit(0)}
const values=Object.fromEntries(readFileSync(file,'utf8').split(/\r?\n/).filter(s=>s.trim()&&!s.trim().startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}))
const result=validateReleaseConfig({appEnv:values.VITE_APP_ENV,apiMode:values.VITE_API_MODE,apiBaseUrl:values.VITE_API_BASE_URL,channel:values.VITE_CHANNEL,requestTimeoutMs:Number(values.VITE_REQUEST_TIMEOUT_MS),pugaAccessUrl:values.VITE_PUGAACCESS_URL,nAtlasEndpoint:values.VITE_NATLAS_ENDPOINT})
for(const e of result.errors)console.error('ERROR:',e)
for(const w of result.warnings)console.warn('WARNING:',w)
console.log(result.ok?'Release environment preflight passed.':'Release environment preflight failed.')
if(!result.ok)process.exitCode=1
