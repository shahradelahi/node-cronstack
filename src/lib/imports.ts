export async function tsup() {
  const { default: tsup } = await import('tsup');
  return tsup;
}
