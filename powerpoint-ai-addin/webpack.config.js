/* Minimal webpack config placeholder.
 * If you want, we can replace this with the official generator-office scaffolding.
 */
console.log('[powerpoint-ai-addin] Loaded webpack.config.js (server/https fix applied)');

const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Default Office dev-certs location (office-addin-dev-certs)
const DEFAULT_CERT_DIR = path.join(process.env.USERPROFILE || process.env.HOME || '', '.office-addin-dev-certs');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(DEFAULT_CERT_DIR, 'localhost.crt');
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(DEFAULT_CERT_DIR, 'localhost.key');

module.exports = {
  entry: {
    taskpane: path.resolve(__dirname, 'src/taskpane/index.tsx'),
    web: path.resolve(__dirname, 'src/web/index.tsx')
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
    publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/taskpane/taskpane.html'),
      // Match the manifest SourceLocation (default: /taskpane.html)
      filename: 'taskpane.html',
      chunks: ['taskpane'],
      templateParameters: {
        BACKEND_PORT: process.env.BACKEND_PORT || '3000'
      }
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/web/web.html'),
      // Web demo (served by the SAME dev server started by run_dev.py)
      filename: 'web.html',
      chunks: ['web'],
      templateParameters: {
        BACKEND_PORT: process.env.BACKEND_PORT || '3000'
      }
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },

    // webpack-dev-server v5 uses `server`, not `https`.
    // Office add-ins require https for the taskpane.
    server:
      fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)
        ? {
            type: 'https',
            options: {
              cert: fs.readFileSync(SSL_CERT_PATH),
              key: fs.readFileSync(SSL_KEY_PATH)
            }
          }
        : 'http',

    historyApiFallback: {
      index: '/taskpane.html'
    },
    port: 3001,
    hot: true
  }
};
