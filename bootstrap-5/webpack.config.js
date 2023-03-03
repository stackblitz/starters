const path = require('path');

module.exports = {
  mode: 'development',
  target: 'web',
  devServer: {
    open: 'google-chrome',
    port: 9000,
    contentBase: [
      path.join(__dirname, 'src'),
      path.join(__dirname, 'dist'),
    ],
    watchContentBase: true,
    liveReload: true
  },
  module: {
    rules: [
      {
        test: /\.scss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          {
            loader: "sass-loader",
            options: {
              // Prefer `dart-sass`
              implementation: require.resolve("sass"),
            },
          },
        ],
      },
    ],
  },
};