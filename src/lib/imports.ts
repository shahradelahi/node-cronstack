export async function tsup() {
  // Typescript is one of tsup dependencies
  if (!(await checkoutPackage('typescript'))) {
    throw new Error(`Cannot find 'typescript' module. Did you install it?`);
  }

  const { default: tsup } = await import('tsup');
  return tsup;
}

/**
 * Asynchronously checks out a package availability.
 *
 * @param {string} pkg - the package to check out
 * @return {Promise<boolean>} true if the package was successfully checked out, false otherwise
 */
async function checkoutPackage(pkg: string): Promise<boolean> {
  try {
    const impPkg = await import(pkg);
    return !!impPkg;
  } catch (error) {
    return false;
  }
}
