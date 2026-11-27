import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ["public/mediapipe/**", "public/sw.js", "out/**", "android/**", ".cap-tmp-api/**"],
  },
];
export default eslintConfig;
