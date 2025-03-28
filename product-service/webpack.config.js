const path = require("path");
const glob = require("glob");

// Get all JavaScript/TypeScript files in the src/functions directory
const entryPoints = glob
  .sync("./src/functions/*/index.ts")
  .reduce((acc, path) => {
    const entry = path
      .replace("./src/functions/", "")
      .replace("/index.ts", "")
      .replace("\\index.ts", "");
    acc[entry] = "./" + path;
    return acc;
  }, {});

module.exports = {
  mode: "development",
  target: "node",
  devtool: "source-map",
  entry: entryPoints,
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name]/index.js",
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  externals: [
    "aws-sdk",
    "@aws-sdk/client-cloudformation",
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/lib-dynamodb",
  ],
  /*optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: true,
    concatenateModules: true,
    mangleExports: true,
    innerGraph: true,
    minimizer: [
      new (require("terser-webpack-plugin"))({
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
  },*/
};
