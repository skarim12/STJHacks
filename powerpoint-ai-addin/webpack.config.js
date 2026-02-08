/* Minimal webpack config placeholder.
 * If you want, we can replace this with the official generator-office scaffolding.
 */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    taskpane: path.resolve(__dirname, 'src/taskpane/index.tsx')
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
      filename: 'index.html',
      chunks: ['taskpane'],
      templateParameters: {
        BACKEND_PORT: process.env.BACKEND_PORT || '3000'
      }
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    historyApiFallback: true,
    port: 3001,
    hot: true
  }
};
