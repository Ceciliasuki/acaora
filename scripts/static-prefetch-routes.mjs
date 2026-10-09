// Public, build-time pages only. Never route account APIs through static assets.
// The home page reads viewer cookies when auth is configured, so it is dynamic.
export const staticPrefetchRoutes = [
  '/auth', '/auth/reset', '/courses', '/dashboard', '/data',
  '/dev/ui-kit', '/papers', '/projects', '/settings',
];
export const prefetchAssetDirectory = 'acaora-segments';
// The deployed adapter does not substitute captures from request headers.
// These are the three segment files generated for each supported page; the
// postbuild check fails if Next changes this shape or a page adds a layout.
export const staticPrefetchEntries = staticPrefetchRoutes.flatMap(source =>
  ['_tree', '_full', `${source.slice(1)}/__PAGE__`].map(segment => ({source, segment})),
);
