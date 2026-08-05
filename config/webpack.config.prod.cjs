const path = require("path");
const webpack = require("webpack");
const TerserJSPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const envPath = path.resolve(__dirname, `../.env/.env.prod`);
const envConfig = require("dotenv").config({ path: envPath }).parsed;

const definePlugin = {};
Object.keys(envConfig).map((key) => {
  definePlugin[`process.env.${key}`] = JSON.stringify(envConfig[key]);
});

// Path normalization helper
const normalizePath = (inputPath) => {
  return path.normalize(inputPath).replace(/\\/g, "/");
};

// Normalized cwd
const cwd = normalizePath(process.cwd());

const config = {
  mode: "production",
  devtool: false,
  output: {
    clean: true,
    path: path.resolve(__dirname, "../dist"),
    filename: (pathData) => {
      let name = pathData.chunk.name;
      if (name === "main") {
        return "static/js/[name].[hash:8].js";
      }
      return "static/js/[name].[hash:8].chunk.js";
    },
    chunkFilename: "static/js/[name].[hash:8].chunk.js",
    assetModuleFilename: "static/media/[ext]/[hash][ext][query]",
  },
  plugins: [
    new webpack.DefinePlugin(definePlugin),
    new MiniCssExtractPlugin({
      filename: (pathData) => {
        let name = pathData.chunk.name;
        if (name === "main") {
          return "static/css/[name].[hash:8].css";
        }
        return "static/css/[name].[hash:8].chunk.css";
      },
      // Async chunks have no name, fall back to [id] (avoids name rendering as the literal undefined)
      chunkFilename: "static/css/[id].[hash:8].chunk.css",
      // 页面级代码分割后，同一批 hsu-ui 组件在不同页面 chunk 里的引入顺序不一致，
      // 插件会逐个报 "Conflicting order"。本项目（含 hsu-ui）的组件样式全部是
      // CSS Modules（类名带 hash 作用域），不存在跨模块层叠覆盖，顺序无关紧要。
      // 全局样式由 index.tsx 显式按序引入，不受影响。
      ignoreOrder: true,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: normalizePath(path.resolve(__dirname, "../public")),
          to: normalizePath(path.resolve(__dirname, "../dist")),
          globOptions: {
            dot: true,
            gitignore: true,
            ignore: ["**/index.html"],
          },
          noErrorOnMissing: false,
          force: true,
          context: cwd, // Add context configuration
        },
      ],
    }),
    new CleanWebpackPlugin(),
  ],
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        // 首屏 vendor：只切入口图里的三方库。
        //
        // 这里必须是 "initial" 而不是 "all"。按包名命名（name()）会把同一个包的
        // 模块全部并进一个具名 chunk，而 "all" 让这个合并跨越 initial 与 async 两类
        // chunk group——只要某个包在任何地方被引用，合并出来的具名 chunk 就会被算进
        // 首屏。实测后果：wangeditor / zxcvbn / pdfjs / xlsx / codemirror 这些只有
        // 懒加载页面才用到的库全部出现在 index.html 的 <script> 里。
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          chunks: "initial",
          name(module) {
            const packageName = module.context.match(
              /[\\/]node_modules[\\/](.*?)([\\/]|$)/
            )?.[1];
            // Return undefined when no package name matches, letting webpack name it by chunk id (avoids the literal "undefined")
            return packageName ? packageName.replace("@", "") : undefined;
          },
          minSize: 20 * 1024,
          maxSize: 200 * 1024,
          minChunks: 1,
          priority: 100,
          reuseExistingChunk: true,
        },
        // 被多个懒加载页面共用的三方库单独成块，避免每个页面各带一份
        asyncVendors: {
          test: /[\\/]node_modules[\\/]/,
          chunks: "async",
          minChunks: 2,
          minSize: 30 * 1024,
          maxSize: 300 * 1024,
          priority: 50,
          reuseExistingChunk: true,
        },
      },
    },
    minimizer: [
      new TerserJSPlugin({
        extractComments: false,
        parallel: true,
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        },
      }),
      new CssMinimizerPlugin({
        parallel: true,
      }),
    ],
  },
};

module.exports = config;
