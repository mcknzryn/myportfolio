const header = document.querySelector('.site-header');
const toggle = header?.querySelector('.menu-toggle');
const navigation = header?.querySelector('#site-navigation');

if (header && toggle && navigation) {
  const closeMenu = () => {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  navigation.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 800) closeMenu();
  });
}
