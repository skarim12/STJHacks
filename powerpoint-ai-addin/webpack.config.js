/* Minimal webpack config placeholder.
 * If you want, we can replace this with the official generator-office scaffolding.
 */
const path = require('path');

module.exports = {
  entry: {
    taskpane: path.resolve(__dirname, 'src/taskpane/index.tsx')
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true
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
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    port: 3001,
    hot: true
  }
};
