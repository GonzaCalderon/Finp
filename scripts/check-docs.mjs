import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const docsRoot = join(root, 'docs')
const canonicalRootDocs = ['AGENTS.md', 'README.md', 'design.md']
const excludedDirectories = new Set(['archivados'])
const excludedFromCatalog = new Set(['decisiones/plantilla.md'])
const errors = []

function walkMarkdown(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
            if (directory === docsRoot && excludedDirectories.has(entry.name)) return []
            return walkMarkdown(path)
        }
        return entry.isFile() && extname(entry.name).toLowerCase() === '.md' ? [path] : []
    })
}

function githubSlug(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[`*_~]/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
}

function headings(content) {
    const used = new Map()
    const result = new Set()

    for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
        const base = githubSlug(match[1])
        const count = used.get(base) ?? 0
        used.set(base, count + 1)
        result.add(count === 0 ? base : `${base}-${count}`)
    }

    return result
}

function validateStructure(file) {
    const content = readFileSync(file, 'utf8')
    const label = relative(root, file).split(sep).join('/')

    if (!/^#\s+\S/m.test(content)) errors.push(`${label}: falta título H1`)
    if (!/^##\s+Índice\s*$/m.test(content)) errors.push(`${label}: falta sección "## Índice"`)
    if (/[ \t]+$/m.test(content)) errors.push(`${label}: contiene espacios al final de línea`)

    if (file.startsWith(docsRoot) && !/^>\s+Estado:/m.test(content)) {
        errors.push(`${label}: falta metadato "Estado"`)
    }

    if (file.startsWith(docsRoot) && !/^>\s+Audiencia:/m.test(content)) {
        errors.push(`${label}: falta metadato "Audiencia"`)
    }

    if (file.startsWith(docsRoot) && !/^>\s+Fuente de verdad:/m.test(content)) {
        errors.push(`${label}: falta metadato "Fuente de verdad"`)
    }

    if (file.startsWith(docsRoot) && !/^>\s+Última actualización:/m.test(content) && !/^>\s+Fecha:/m.test(content)) {
        errors.push(`${label}: falta fecha de actualización o decisión`)
    }
}

function validateLinks(file) {
    const content = readFileSync(file, 'utf8')
    const label = relative(root, file).split(sep).join('/')

    for (const match of content.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
        const rawTarget = match[1].trim().replace(/^<|>$/g, '')
        if (!rawTarget || /^(https?:|mailto:)/i.test(rawTarget)) continue

        const [rawPath, fragment] = rawTarget.split('#', 2)
        const decodedPath = decodeURIComponent(rawPath)
        const target = decodedPath ? resolve(dirname(file), decodedPath) : file

        if (!existsSync(target)) {
            errors.push(`${label}: enlace inexistente "${rawTarget}"`)
            continue
        }

        if (fragment && statSync(target).isFile() && extname(target).toLowerCase() === '.md') {
            const targetHeadings = headings(readFileSync(target, 'utf8'))
            const decodedFragment = decodeURIComponent(fragment)
            if (!targetHeadings.has(decodedFragment)) {
                errors.push(`${label}: ancla inexistente "${rawTarget}"`)
            }
        }
    }
}

const activeDocs = walkMarkdown(docsRoot)
const filesToValidate = [
    ...canonicalRootDocs.map((path) => join(root, path)),
    ...activeDocs,
]

for (const file of filesToValidate) {
    validateStructure(file)
    validateLinks(file)
}

const catalog = readFileSync(join(docsRoot, 'README.md'), 'utf8')
for (const file of activeDocs) {
    const path = relative(docsRoot, file).split(sep).join('/')
    if (path === 'README.md' || excludedFromCatalog.has(path)) continue
    if (!catalog.includes(path)) errors.push(`docs/README.md: no indexa "${path}"`)
}

if (errors.length > 0) {
    console.error(`Documentación inválida (${errors.length} problema${errors.length === 1 ? '' : 's'}):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
} else {
    console.log(`Documentación válida: ${filesToValidate.length} archivos activos revisados.`)
}
