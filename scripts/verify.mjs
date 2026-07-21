#!/usr/bin/env node
// verify.mjs <file> --pub <public.pem>   (expects <file>.sig alongside)
import { readFile } from 'node:fs/promises'
import { verifyBytes } from './sign.mjs'

const args = process.argv.slice(2)
const pubFlag = args.indexOf('--pub')
const file = args.find((_a, i) => i !== pubFlag && i !== pubFlag + 1)
if (!file || pubFlag < 0) {
  console.error('usage: verify.mjs <file> --pub <public.pem>')
  process.exit(2)
}
const ok = verifyBytes(
  await readFile(file),
  (await readFile(`${file}.sig`, 'utf8')).trim(),
  await readFile(args[pubFlag + 1], 'utf8')
)
console.log(ok ? `[verify] OK ${file}` : `[verify] FAILED ${file}`)
process.exit(ok ? 0 : 1)
