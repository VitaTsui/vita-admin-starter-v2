const path = require("path");
// node_modules 一律排除、但放行组件库自带的 scss 与图片。判定由组件库导出——
// 手写正则在 pnpm 的嵌套路径下会失效（详见 @hsu-react/ui 的 guide）
const {
  excludeNodeModulesExceptHsuUi,
} = require("@hsu-react/ui/lib/build/webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const envPath = path.resolve(__dirname, `../.env/.env.common`);
const envConfig = require("dotenv").config({ path: envPath }).parsed;

const PASS_CLS = JSON.parse(envConfig.PASS_CLS);


const config = {
  entry: {
    main: path.resolve(__dirname, "../src/index.tsx"),
  },
  output: {
    publicPath: "/",
  },
  module: {
    rules: [
      {
        // The es output of @hsu-react/ui is ESM (type:module) and its relative imports omit
        // extensions; disable webpack5's strict fullySpecified check to allow extensionless resolution.
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      },
      {
        // x-data-spreadsheet's src/index.js does `import './index.less'`, but its styles are already
        // provided by dist/xspreadsheet.css imported through @hsu-react/ui; treat that less file as a
        // string module (nothing consumes its export, safe at build and runtime), removing the need
        // for less/less-loader
        test: /node_modules[\\/]x-data-spreadsheet[\\/]src[\\/]index\.less$/,
        type: "asset/source",
      },
      {
        test: /\.(png|jpe?g|gif|webp|svg)$/i,
        // Exclude node_modules, but allow the image assets shipped with @hsu-react/ui
        exclude: excludeNodeModulesExceptHsuUi,
        type: "asset/resource",
      },
      {
        test: /\.(mp4)$/i,
        exclude: /node_modules/,
        type: "asset/resource",
      },
      {
        test: /\.(ttf|otf)$/i,
        exclude: /node_modules/,
        type: "asset/resource",
      },
      {
        test: /\.ts(x)?$/,
        exclude: /node_modules/,
        use: ["ts-loader"],
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                auto: true,
                localIdentName: "[local]--[hash:base64:5]",
                getLocalIdent: (_, __, localName) => {
                  for (const key in PASS_CLS) {
                    if (PASS_CLS[key] === "LK" && localName.startsWith(key)) {
                      return localName;
                    } else if (PASS_CLS[key] === "EQ" && localName === key) {
                      return localName;
                    }
                  }

                  return undefined;
                },
              },
            },
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [require("autoprefixer")],
              },
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        // Allow the scss in @hsu-react/ui's es output (the library ships uncompiled .module.scss, which this project must compile), exclude the rest of node_modules
        exclude: excludeNodeModulesExceptHsuUi,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                auto: true,
                localIdentName: "[local]--[hash:base64:5]",
                getLocalIdent: (_, __, localName) => {
                  for (const key in PASS_CLS) {
                    if (PASS_CLS[key] === "LK" && localName.startsWith(key)) {
                      return localName;
                    } else if (PASS_CLS[key] === "EQ" && localName === key) {
                      return localName;
                    }
                  }

                  return undefined;
                },
              },
            },
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [require("autoprefixer")],
              },
            },
          },
          {
            loader: "sass-loader",
            options: {
              additionalData: `@use "@/styles/variables.global.scss";`,
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      // Template path; must match the index.html path
      template: path.resolve(__dirname, "../public/index.html"),
    }),
  ],
  resolve: {
    extensions: [
      ".tsx",
      ".ts",
      ".js",
      ".jsx",
      ".mts",
      ".cts",
      ".cjs",
      ".mjs",
      ".scss",
    ],
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
    fallback: {
      bson: require.resolve("bson"),
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      vm: require.resolve("vm-browserify"),
    },
  },
};

module.exports = config;
