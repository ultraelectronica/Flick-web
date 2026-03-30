import "./style.css";
import { Navbar, initNavbarScroll } from "./components/navbar";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { Specs } from "./components/specs";
import { Contributors } from "./components/contributors";
import { Footer } from "./components/footer";
import { ReleaseNotesPage } from "./components/release-notes-page";
import {
  fetchLatestRelease,
  fetchLatestCommit,
  fetchContributors,
  initReleaseNotesPage,
} from "./api/github";
import {
  initAnimations,
  initHeroAnimation,
  initNavbarAnimation,
} from "./animations";

type AppRoute = "home" | "release-notes";

function getCurrentRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return hash === "release-notes" ? "release-notes" : "home";
}

function renderHomePage(): string {
  return `
    ${Hero()}
    ${Features()}
    ${Specs()}
    ${Contributors()}
  `;
}

function renderApp(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const route = getCurrentRoute();
  const pageMarkup =
    route === "release-notes" ? ReleaseNotesPage() : renderHomePage();

  app.innerHTML = `
    ${Navbar(route)}
    ${pageMarkup}
    ${Footer(route)}
  `;

  initNavbarScroll();
  initNavbarAnimation();
  initAnimations();
  fetchLatestCommit();

  if (route === "release-notes") {
    void initReleaseNotesPage();
    initImageModal();
    return;
  }

  initHeroAnimation();
  fetchLatestRelease();
  fetchContributors();
}

window.addEventListener("hashchange", () => {
  window.scrollTo(0, 0);
  renderApp();
});

renderApp();

function initImageModal(): void {
  const modal = document.getElementById(
    "image-modal",
  ) as HTMLDialogElement | null;
  const modalImg = document.getElementById(
    "image-modal-img",
  ) as HTMLImageElement | null;
  const closeBtn = document.getElementById("image-modal-close");
  if (!modal || !modalImg) return;

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG" && target.hasAttribute("data-release-img")) {
      modalImg.src = (target as HTMLImageElement).src;
      modal.showModal();
    }
  });

  modalImg.addEventListener("click", () => modal.close());
  closeBtn?.addEventListener("click", () => modal.close());

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
}
