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
  return window.location.hash.includes("release-notes") ? "release-notes" : "home";
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
  const pageMarkup = route === "release-notes" ? ReleaseNotesPage() : renderHomePage();

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
