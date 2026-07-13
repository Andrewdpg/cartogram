import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  validateDiagramShape,
  checkCrossFileReferences,
  InvalidDiagramError,
} from '../src/lib/validateDiagram'
import type { Diagram } from '../src/lib/types'

const DIAGRAMS_DIR = join(import.meta.dirname, '..', 'diagrams')

function main() {
  const files = readdirSync(DIAGRAMS_DIR).filter((f) => f.endsWith('.json'))
  const diagrams: Record<string, Diagram> = {}
  const errors: string[] = []

  for (const file of files) {
    const id = file.replace(/\.json$/, '')
    const raw = JSON.parse(readFileSync(join(DIAGRAMS_DIR, file), 'utf-8'))
    try {
      diagrams[id] = validateDiagramShape(raw, id)
    } catch (err) {
      if (err instanceof InvalidDiagramError) {
        errors.push(err.message)
      } else {
        throw err
      }
    }
  }

  errors.push(...checkCrossFileReferences(diagrams))

  if (errors.length > 0) {
    console.error('Diagram validation failed:\n')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(`✓ ${files.length} diagram(s) validated OK`)
}

main()
