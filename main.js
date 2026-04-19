const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.getElementById('mobileMenu');
const navLinks = document.querySelectorAll('.site-nav a, .mobile-menu a, .site-footer__nav a');
const sectionLinks = document.querySelectorAll('a[href^="#"]');
const revealItems = document.querySelectorAll('.reveal');
const filterButtons = document.querySelectorAll('[data-filter]');
const projectCards = document.querySelectorAll('.project-card');
const projectStatus = document.querySelector('[data-project-status]');
const contactForm = document.getElementById('contactForm');
const themeToggle = document.querySelector('[data-theme-toggle]');
const themeToggleLabel = document.querySelector('[data-theme-toggle-label]');
const themeLogos = document.querySelectorAll('[data-theme-logo]');
const footerThemeLogo = document.querySelector('.site-footer__logo[data-theme-logo]');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const themeFavicon = document.querySelector('link[rel="icon"]');
const THEME_STORAGE_KEY = 'tempo-theme';
const SITE_CONTENT_URL = 'content/site-content.json';
const galleryCache = new Map();
const galleryModal = document.querySelector('[data-gallery-modal]');
const galleryTitle = document.querySelector('[data-gallery-title]');
const galleryCategory = document.querySelector('[data-gallery-category]');
const galleryCounter = document.querySelector('[data-gallery-counter]');
const galleryCaption = document.querySelector('[data-gallery-caption]');
const galleryImage = document.querySelector('[data-gallery-image]');
const galleryPrev = document.querySelector('[data-gallery-prev]');
const galleryNext = document.querySelector('[data-gallery-next]');
const galleryCloseButtons = document.querySelectorAll('[data-gallery-close]');

let siteContent = null;
let galleriesByProjectId = new Map();
let activeGalleryProjectId = '';
let activeGalleryIndex = 0;

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' ? 'light' : 'dark';
  } catch (_) {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }
}

function applyTheme(theme, persist = true) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;

  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(nextTheme === 'light'));
    themeToggle.setAttribute('aria-label', nextTheme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  }

  if (themeToggleLabel) {
    themeToggleLabel.textContent = nextTheme === 'light' ? 'Claro' : 'Oscuro';
  }

  themeLogos.forEach((logo) => {
    logo.src = nextTheme === 'light' ? 'assets/logo-negro.png' : 'assets/logo-blanco.png';
  });

  if (footerThemeLogo) {
    footerThemeLogo.src = nextTheme === 'light' ? 'assets/logo-negro-footer.png' : 'assets/logo-blanco.png';
  }

  if (themeMeta) {
    themeMeta.setAttribute('content', nextTheme === 'light' ? '#f5efe4' : '#0f0c09');
  }

  if (themeFavicon) {
    themeFavicon.href = nextTheme === 'light' ? 'assets/logo-negro.png' : 'assets/logo-blanco.png';
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (_) {}
  }
}

function setMediaPhoto(slot, photo, loading = 'lazy') {
  if (!slot || !photo?.src) return;

  const existing = slot.querySelector('.media-photo');
  if (existing) existing.remove();

  const image = document.createElement('img');
  image.className = 'media-photo';
  image.src = photo.src;
  image.alt = photo.alt || '';
  image.decoding = 'async';
  image.loading = loading;

  slot.prepend(image);
}

async function fetchFolderImages(folder) {
  const normalizedFolder = folder.endsWith('/') ? folder : `${folder}/`;
  const folderUrl = new URL(normalizedFolder, document.baseURI);
  const cacheKey = folderUrl.pathname;

  if (galleryCache.has(cacheKey)) {
    return galleryCache.get(cacheKey);
  }

  const response = await fetch(folderUrl.href, { cache: 'no-store' });
  if (!response.ok) {
    galleryCache.set(cacheKey, []);
    return [];
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = [...doc.querySelectorAll('a')]
    .map((anchor) => anchor.getAttribute('href') || '')
    .filter((href) => /\.(jpe?g|png|webp)$/i.test(href))
    .map((href) => new URL(href, folderUrl).pathname)
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));

  galleryCache.set(cacheKey, images);
  return images;
}

async function loadSiteContent() {
  const response = await fetch(SITE_CONTENT_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`No se pudo leer ${SITE_CONTENT_URL}`);
  }

  return response.json();
}

function renderProjectGalleryButtons() {
  document.querySelectorAll('[data-open-gallery]').forEach((button) => {
    const card = button.closest('[data-project-id]');
    const project = card ? galleriesByProjectId.get(card.dataset.projectId) : null;
    const count = project?.gallery?.length || 0;
    button.textContent = count > 0 ? `Ver fotos (${count})` : 'Ver fotos';
    button.disabled = count === 0;
  });
}

function renderConfiguredMedia() {
  if (!siteContent) return;

  const heroSlot = document.querySelector('[data-photo-slot="hero"]');
  const aboutSlot = document.querySelector('[data-photo-slot="about"]');
  setMediaPhoto(heroSlot, siteContent.hero, 'eager');
  setMediaPhoto(aboutSlot, siteContent.about);

  siteContent.projects.forEach((project) => {
    const card = document.querySelector(`[data-project-id="${project.id}"]`);
    if (!card) return;

    const media = card.querySelector('.project-card__media');
    setMediaPhoto(media, project.cover);
  });
}

function renderGallery() {
  if (!galleryModal || !siteContent) return;

  const project = siteContent.projects.find((item) => item.id === activeGalleryProjectId);
  const gallery = galleriesByProjectId.get(activeGalleryProjectId)?.gallery || [];
  const current = gallery[activeGalleryIndex];

  if (!project || !current || !galleryImage || !galleryTitle || !galleryCategory || !galleryCounter || !galleryCaption) {
    return;
  }

  galleryImage.src = current.src;
  galleryImage.alt = current.alt || '';
  galleryTitle.textContent = project.title || project.label || 'Proyecto';
  galleryCategory.textContent = project.label || 'Galería';
  galleryCounter.textContent = `${activeGalleryIndex + 1} / ${gallery.length}`;
  galleryCaption.textContent = current.alt || current.src.split('/').pop() || '';

  if (galleryPrev) {
    galleryPrev.disabled = gallery.length <= 1;
  }

  if (galleryNext) {
    galleryNext.disabled = gallery.length <= 1;
  }
}

function openGallery(projectId) {
  const project = galleriesByProjectId.get(projectId);
  if (!project || !project.gallery.length || !galleryModal) return;

  activeGalleryProjectId = projectId;
  activeGalleryIndex = 0;
  galleryModal.hidden = false;
  document.body.style.overflow = 'hidden';
  renderGallery();
  galleryCloseButtons.forEach((button) => button.blur());
  galleryModal.querySelector('[data-gallery-close]')?.focus();
}

function closeGallery() {
  if (!galleryModal) return;
  galleryModal.hidden = true;
  document.body.style.overflow = '';
}

function stepGallery(direction) {
  const project = galleriesByProjectId.get(activeGalleryProjectId);
  if (!project || !project.gallery.length) return;

  activeGalleryIndex = (activeGalleryIndex + direction + project.gallery.length) % project.gallery.length;
  renderGallery();
}

async function setupContent() {
  try {
    siteContent = await loadSiteContent();
  } catch (error) {
    console.error(error);
    return;
  }

  const projects = await Promise.all(siteContent.projects.map(async (project) => {
    const galleryPaths = await fetchFolderImages(project.galleryFolder);
    const gallery = galleryPaths.map((src, index) => ({
      src,
      alt: `${project.label} · foto ${index + 1}`,
    }));

    return {
      ...project,
      gallery: gallery.length ? gallery : [{ ...project.cover }],
    };
  }));

  galleriesByProjectId = new Map(projects.map((project) => [project.id, project]));
  siteContent = { ...siteContent, projects };
  renderConfiguredMedia();
  renderProjectGalleryButtons();
}

themeToggle?.addEventListener('click', () => {
  const currentTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(currentTheme === 'light' ? 'dark' : 'light');
});

applyTheme(getSavedTheme(), false);
setupContent();

galleryCloseButtons.forEach((button) => {
  button.addEventListener('click', closeGallery);
});

galleryPrev?.addEventListener('click', () => stepGallery(-1));
galleryNext?.addEventListener('click', () => stepGallery(1));

document.addEventListener('keydown', (event) => {
  if (galleryModal && !galleryModal.hidden) {
    if (event.key === 'ArrowLeft') stepGallery(-1);
    if (event.key === 'ArrowRight') stepGallery(1);
    if (event.key === 'Escape') closeGallery();
  }
});

document.addEventListener('click', (event) => {
  const openButton = event.target.closest?.('[data-open-gallery]');
  if (openButton) {
    const card = openButton.closest('[data-project-id]');
    if (card?.dataset.projectId) {
      openGallery(card.dataset.projectId);
    }
    return;
  }

  const media = event.target.closest?.('.project-card__media');
  if (media) {
    const card = media.closest('[data-project-id]');
    if (card?.dataset.projectId) {
      openGallery(card.dataset.projectId);
    }
    return;
  }

  if (event.target.closest?.('[data-gallery-close]')) {
    closeGallery();
  }
});

function setMenu(open) {
  if (!menuToggle || !mobileMenu) return;
  menuToggle.setAttribute('aria-expanded', String(open));
  mobileMenu.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
}

menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  setMenu(open);
});

mobileMenu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

const headerObserver = new IntersectionObserver(([entry]) => {
  header?.classList.toggle('is-scrolled', !entry.isIntersecting);
}, { threshold: 0 });

const heroAnchor = document.getElementById('inicio');
if (heroAnchor) headerObserver.observe(heroAnchor);

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const id = entry.target.id;
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
    });
  });
}, { rootMargin: '-45% 0px -45% 0px', threshold: 0.05 });

document.querySelectorAll('section[id]').forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealItems.forEach((el) => revealObserver.observe(el));

function updateProjectStatus(label) {
  if (!projectStatus) return;
  const visibleCount = [...projectCards].filter((card) => !card.classList.contains('is-hidden')).length;
  projectStatus.textContent = label === 'all'
    ? `${visibleCount} proyectos visibles`
    : `${visibleCount} proyectos visibles en ${label}`;
}

function setFilter(activeFilter) {
  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === activeFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  projectCards.forEach((card) => {
    const match = activeFilter === 'all' || card.dataset.category === activeFilter;
    card.classList.toggle('is-hidden', !match);
  });

  updateProjectStatus(activeFilter);
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter || 'all'));
});

setFilter('all');

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;

  const formData = new FormData(contactForm);
  const name = String(formData.get('name') || '').trim();
  const project = String(formData.get('project') || '').trim();
  const message = String(formData.get('message') || '').trim();

  const text = [
    'Hola Tempo Disegno, quiero consultar un proyecto.',
    `Nombre: ${name}`,
    `Proyecto: ${project}`,
    `Detalle: ${message}`,
  ].join('\n');

  const url = `https://wa.me/5492612098239?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
});

sectionLinks.forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});
