// Code colours: a neutral ink for most of the code, and four hues that each mean one thing. Keywords
// are lilac, strings sand, numbers and constants mint, types sky. Orange is not among them: it is the
// accent, and in code it only ever marks an answer the checker asserted. The same values are the
// `--hx-tk-*` tokens of theme/style.css, which colour the live code of the labs.
import type { ThemeRegistration } from "shiki";

interface Palette {
  fg: string;
  comment: string;
  keyword: string;
  type: string;
  string: string;
  constant: string;
  fn: string;
}

const theme = (name: string, type: "light" | "dark", p: Palette): ThemeRegistration => ({
  name,
  type,
  colors: { "editor.background": "#00000000", "editor.foreground": p.fg },
  tokenColors: [
    { settings: { foreground: p.fg } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: p.comment, fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.operator.new",
        "keyword.control",
      ],
      settings: { foreground: p.keyword },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: p.type },
    },
    {
      scope: ["string", "string.template", "punctuation.definition.string"],
      settings: { foreground: p.string },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character", "support.constant"],
      settings: { foreground: p.constant },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: p.fn },
    },
    { scope: ["entity.name.tag", "support.class.component"], settings: { foreground: p.keyword } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: p.type } },
  ],
});

export const codeLight = theme("hyrax-light", "light", {
  fg: "#2a2622",
  comment: "#6c665c",
  keyword: "#7c3fc0",
  type: "#0b6a9e",
  string: "#8a5a00",
  constant: "#0f7a55",
  fn: "#14110e",
});

export const codeDark = theme("hyrax-dark", "dark", {
  fg: "#e4e0d8",
  comment: "#8d877d",
  keyword: "#c4a5f7",
  type: "#79c0f2",
  string: "#e6c87b",
  constant: "#7fd1ae",
  fn: "#fbf8f3",
});
