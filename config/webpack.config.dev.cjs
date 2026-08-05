const path = require("path");
const webpack = require("webpack");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const envPath = path.resolve(__dirname, `../.env/.env.dev`);
const envConfig = require("dotenv").config({ path: envPath }).parsed;

const definePlugin = {};
const api_proxy = {};
Object.keys(envConfig).map((key) => {
  definePlugin[`process.env.${key}`] = JSON.stringify(envConfig[key]);

  if (key === "API_PROXY") {
    const _api_proxy = JSON.parse(envConfig[key]);
    Object.keys(_api_proxy).map((key) => {
      api_proxy[key] = {
        target: _api_proxy[key]?.target,
        pathRewrite: _api_proxy[key]?.pathRewrite,
        changeOrigin: true,
      };

      if (_api_proxy[key]?.ReqHeader) {
        api_proxy[key].onProxyReq = (proxyReq) => {
          Object.keys(_api_proxy[key].ReqHeader).map((_key) => {
            proxyReq.setHeader(_key, _api_proxy[key].ReqHeader[_key]);
          });
        };
      }
    });
  }
});

const config = {
  mode: "development",
  devtool: "inline-source-map",
  plugins: [
    new webpack.DefinePlugin(definePlugin),
    // 与 webpack.config.prod.cjs 保持一致：页面级代码分割后，同一批 hsu-ui 组件在不同
    // 页面 chunk 里的引入顺序不一致，插件会逐个报 "Conflicting order" 刷屏。本项目
    // （含 hsu-ui）的组件样式全部是 CSS Modules（类名带 hash 作用域），不存在跨模块
    // 层叠覆盖，顺序无关紧要。全局样式由 index.tsx 显式按序引入，不受影响。
    new MiniCssExtractPlugin({ ignoreOrder: true }),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        memoryLimit: 4096,
        diagnosticOptions: { semantic: true, syntactic: true },
      },
      async: true,
    }),
    new ReactRefreshWebpackPlugin({ overlay: false }),
  ],
  stats: "errors-only",
  devServer: {
    client: {
      logging: "error",
      overlay: false,
    },
    historyApiFallback: true,
    compress: false,
    hot: true,
    port: [envConfig.SERVER_PROT],
    proxy: api_proxy,
  },
};

module.exports = config;
