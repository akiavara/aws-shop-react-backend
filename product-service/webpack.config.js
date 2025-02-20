const path = require('path');
const glob = require('glob');

// Get all JavaScript/TypeScript files in the src/functions directory
const entries = glob.sync('./src/functions/*/index.ts').reduce((acc, file) => {
  const name = file.split('/')[3]; // Get the function name from the path
  acc[name] = './' + file;
  return acc;
}, {});

module.exports = {
  target: 'node',
  mode: 'production',
  entry: entries,
  output: {
    filename: '[name]/index.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
  },
  externals: [
    'aws-sdk',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
    'uuid'
  ],
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: true,
    concatenateModules: true,
    mangleExports: true,
    innerGraph: true,
    minimizer: [
      new (require('terser-webpack-plugin'))({
        terserOptions: {
          compress: {
            unused: true,
            dead_code: true,
            passes: 2,
          },
          mangle: true,
          module: true,
        },
      }),
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};