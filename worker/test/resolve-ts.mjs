// Lets Node run the Worker sources directly: relative imports are written without extensions.
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) { if (specifier.startsWith('.')) return next(specifier + '.ts', context); throw e; }
}
