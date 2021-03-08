import path from 'path'

module.exports = {
  entry: './dist/index.js',
  target: 'node',
  mode: 'production',
  output: {
    filename: 'index.min.js',
    path: path.resolve(__dirname, 'min'),
  },
}
