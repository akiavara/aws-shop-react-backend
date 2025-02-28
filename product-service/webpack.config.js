const path = require('path');

module.exports = {
  entry: {
    getProductList: './src/functions/getProductList/index.ts',
    getProductById: './src/functions/getProductById/index.ts',
  },
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name]/index.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
    clean: true
  },
  optimization: {
    minimize: false
  }
};
