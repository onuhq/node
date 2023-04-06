import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript"
import peerDepsExternal from "rollup-plugin-peer-deps-external"
import json from "@rollup/plugin-json"

const packageJson = require("./package.json")

const extensions = [".js", ".ts"]

const globals = {
  ...packageJson.devDependencies,
}

export default {
  input: "src/index.ts",
  output: [
    {
      file: packageJson.main,
      format: "cjs",
      sourcemap: true,
    },
    {
      file: packageJson.module,
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [peerDepsExternal(), resolve({ extensions }), commonjs(), typescript(), json()],
  external: Object.keys(globals),
}
