const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { key: httpsOptions.key, cert: httpsOptions.cert, ca: httpsOptions.ca };
}

/**
 * Export async config so we can await office-addin-dev-certs.
 * This enables https://localhost:3000 which is required by Office add-ins.
 */
module.exports = async () => {
  /** @type {import('webpack').Configuration} */
  const config = {
    entry: {
      taskpane: "./src/taskpane/index.tsx",
      commands: "./src/commands/commands.ts",
      local: "./src/local/index.tsx",
    },
    output: {
      clean: true,
      path: path.resolve(__dirname, "dist"),
      filename: "[name].bundle.js",
      publicPath: "/",
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext]",
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["commands"],
      }),
      new HtmlWebpackPlugin({
        filename: "local.html",
        template: "./src/local/local.html",
        chunks: ["local"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "src/manifest.xml", to: "manifest.xml" },
          { from: "assets", to: "assets" },
        ],
      }),
    ],
    devServer: {
      port: 3000,
      hot: true,
      server: {
        type: "https",
        options: await getHttpsOptions(),
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      static: {
        directory: path.join(__dirname, "dist"),
      },
    },
  };

  return config;
};
