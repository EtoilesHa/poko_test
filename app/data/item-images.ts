/**
 * Keep quiz images in the client build instead of relying on public root paths.
 * The public deployment serves Vite's bundled assets reliably, including the
 * item cards loaded after the first page render.
 */
const itemImageModules = import.meta.glob('../assets/items/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export function itemImage(id: string): string {
  const image = itemImageModules[`../assets/items/${id}.png`];
  if (!image) {
    throw new Error(`Missing bundled Pokopia item image: ${id}`);
  }
  return image;
}
