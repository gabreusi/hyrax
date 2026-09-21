import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import CheckMark from "./components/CheckMark.vue";
import HomePage from "./components/HomePage.vue";
import NumberLab from "./components/NumberLab.vue";
import PageFacts from "./components/PageFacts.vue";
import RandomLab from "./components/RandomLab.vue";
import StringLab from "./components/StringLab.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("HomePage", HomePage);
    app.component("PageFacts", PageFacts);
    app.component("CheckMark", CheckMark);
    // The labs are used from the markdown of the guides.
    app.component("NumberLab", NumberLab);
    app.component("StringLab", StringLab);
    app.component("RandomLab", RandomLab);
  },
} satisfies Theme;
