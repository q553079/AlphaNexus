import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const aliasRoots = [
  ['@app/', path.join(projectRoot, 'src', 'renderer', 'app')],
  ['@main/', path.join(projectRoot, 'src', 'main')],
  ['@preload/', path.join(projectRoot, 'src', 'preload')],
  ['@renderer/', path.join(projectRoot, 'src', 'renderer')],
  ['@shared/', path.join(projectRoot, 'src', 'shared')],
]

const candidatePaths = (targetPath) => [
  targetPath,
  `${targetPath}.ts`,
  `${targetPath}.tsx`,
  `${targetPath}.js`,
  `${targetPath}.mjs`,
  path.join(targetPath, 'index.ts'),
  path.join(targetPath, 'index.tsx'),
  path.join(targetPath, 'index.js'),
  path.join(targetPath, 'index.mjs'),
]

const resolveExistingPath = (targetPath) => {
  for (const candidate of candidatePaths(targetPath)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

export async function resolve(specifier, context, defaultResolve) {
  for (const [prefix, aliasRoot] of aliasRoots) {
    if (specifier.startsWith(prefix)) {
      const resolvedPath = resolveExistingPath(path.join(aliasRoot, specifier.slice(prefix.length)))
      if (resolvedPath) {
        return {
          url: pathToFileURL(resolvedPath).href,
          shortCircuit: true,
        }
      }
    }
  }

  if (
    (specifier.startsWith('./') || specifier.startsWith('../'))
    && context.parentURL?.startsWith('file:')
    && path.extname(specifier).length === 0
  ) {
    const parentPath = fileURLToPath(context.parentURL)
    const resolvedPath = resolveExistingPath(path.resolve(path.dirname(parentPath), specifier))
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      }
    }
  }

  return defaultResolve(specifier, context, defaultResolve)
}
