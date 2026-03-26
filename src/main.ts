import "./style.css";
import { Navbar, initNavbarScroll } from "./components/navbar";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { Specs } from "./components/specs";
import { Contributors } from "./components/contributors";
import { Footer } from "./components/footer";
import {
  fetchLatestRelease,
  fetchLatestCommit,
  fetchContributors,
} from "./api/github";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  ${Navbar()}
  ${Hero()}
  ${Features()}
  ${Specs()}
  ${Contributors()}
  ${Footer()}
`;

initNavbarScroll();
fetchLatestRelease();
fetchLatestCommit();
fetchContributors();
