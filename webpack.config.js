var path = require('path');
var webpack = require('webpack');


module.exports = {
  entry: './js/main.js',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js'
  },
  debug: true,
  devtool: "source-map",
  target: 'node-webkit',

  // Superagent sucks.
  // https://github.com/visionmedia/superagent/wiki/Superagent-for-Webpack
  plugins: [
    new webpack.DefinePlugin({ 'global.GENTLY': false })
  ],
  node: {
    __dirname: true,
  },

  module: {
    loaders: [
      { test: /\.json$/, loader: 'json' },
      { test: path.join(__dirname, 'js'), loader: 'babel-loader' }
    ]
  }
};
