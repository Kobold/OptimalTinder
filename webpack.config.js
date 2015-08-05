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

  module: {
    loaders: [
      { test: /\.json$/, loader: 'json' },
      { test: path.join(__dirname, 'js'), loader: 'babel-loader' }
    ]
  }
};
