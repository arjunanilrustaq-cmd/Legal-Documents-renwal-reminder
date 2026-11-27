import "./style.css";
import { App } from "./app";
import { store } from "./store";

const root = document.querySelector("#app");
if (!root) throw new Error("#app missing");

await store.init();
new App(root as HTMLElement).start();
