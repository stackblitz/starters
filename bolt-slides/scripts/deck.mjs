#!/usr/bin/env node
/* Deck CLI — the AI/skill (and humans) read + write the deck through this,
   so the deck file stays the single source of truth while authoring stays
   plain JSON.

     node scripts/deck.mjs export [file.json]   print (or write) the deck as JSON
     node scripts/deck.mjs import <file.json>   replace the deck from JSON
     node scripts/deck.mjs reset                re-seed from data/deck.seed.json
     node scripts/deck.mjs status               one line per slide (layout, title, status)

   The JSON format is documented in .bolt/skills/slides/SKILL.md. */
import fs from 'node:fs'
import { openDb, exportDeck, importDeck, getState, persistNow, DB_FILE } from '../server/db.mjs'

const [cmd, arg] = process.argv.slice(2)

await openDb()

if (cmd === 'export') {
  const json = JSON.stringify(exportDeck(), null, 2)
  if (arg) { fs.writeFileSync(arg, json); console.log(`wrote ${arg}`) }
  else console.log(json)
} else if (cmd === 'import') {
  if (!arg) { console.error('usage: deck.mjs import <file.json>'); process.exit(1) }
  importDeck(JSON.parse(fs.readFileSync(arg, 'utf8')))
  persistNow()
  console.log(`imported ${arg} → ${DB_FILE} (${getState().slides.length} slides)`)
} else if (cmd === 'reset') {
  importDeck(JSON.parse(fs.readFileSync(new URL('../data/deck.seed.json', import.meta.url), 'utf8')))
  persistNow()
  console.log(`reset from data/deck.seed.json (${getState().slides.length} slides)`)
} else if (cmd === 'status') {
  const { slides } = getState()
  for (const s of slides) {
    const title = s.props.title ?? s.props.text ?? s.nav ?? ''
    console.log(
      `${String(s.position + 1).padStart(2)} ${s.layout.padEnd(11)} ${s.status.padEnd(12)} ${String(title).slice(0, 60)}`,
    )
  }
} else {
  console.log('usage: node scripts/deck.mjs <export [file] | import <file> | reset | status>')
}
process.exit(0)
