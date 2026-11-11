// The search page: Pagefind's interface, over the index the build wrote to /pagefind/.
window.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-undef
  const ui = new PagefindUI({ element: '#search', showSubResults: true, showImages: false });
  const query = new URLSearchParams(window.location.search).get('q');
  if (query) ui.triggerSearch(query);
});
