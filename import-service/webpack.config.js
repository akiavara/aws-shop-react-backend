const path = require('path');
const glob = require('glob');

// Get all the Lambda function entry points
const entryPoints = glob.sync('./src/*/index.ts').reduce((acc, path) => {
  const entry = path.replace('./src/', '').replace('/index.ts', '');
  acc[entry] = path;
  return acc;
}, {});

module.exports = {
  mode: 'development',
  target: 'node',
  devtool: 'source-map',
  entry: entryPoints,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/index.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};