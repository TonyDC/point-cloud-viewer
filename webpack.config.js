// TODO add postcss, and CSS minifier
const path = require('path');

module.exports = {
    entry: './src/index.js',
    resolve: {
        alias: {
            $: path.resolve(__dirname, '.'),
            js: path.resolve(__dirname, 'src/js/'),
            css: path.resolve(__dirname, 'src/css/')
        }
    },
    module: {
        strictExportPresence: true,
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader'
                ]
            },
            {
                test: /\.(png|svg|jpg|gif)$/,
                use: [
                    'file-loader'
                ]
            }
        ]
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    }
};