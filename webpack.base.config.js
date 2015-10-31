'use strict';

// @see http://christianalfoni.github.io/javascript/2014/12/13/did-you-know-webpack-and-react-is-awesome.html
// @see https://github.com/webpack/react-starter/blob/master/make-webpack-config.js

var path = require('path');
var fs = require('fs');

var webpack = require('webpack');
var _ = require('lodash'); //类似underscore 的一个npm模块
//有时候可能希望项目的样式能不要被打包到脚本中，而是独立出来作为.css，
//然后在页面中以<link>标签引入。这时候我们需要 extract-text-webpack-plugin 来帮忙：
var ExtractTextPlugin = require('extract-text-webpack-plugin'); 
//能夠動態產生 index.html 並支援 Extract Text Plugin 自動將打包完後的 js 與 css 檔加入。
var HtmlWebpackPlugin = require('html-webpack-plugin'); 

var UglifyJsPlugin = webpack.optimize.UglifyJsPlugin; //压缩js 混淆压缩
var CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin; //智能提取公共部分，以提供我们浏览器的缓存复用

//找到当前目录下src 文件件的路径 返回 src文件夹全路径
var srcDir = path.resolve(process.cwd(), 'src');
var assets = 'assets/';
//var sourceMap = require('./src/sourcemap.json');

var excludeFromStats = [
    /node_modules[\\\/]/
];

function makeConf(options) {
	options = options || {};
	var debug = options.debug !== undefined ? options.debug : true;
	var entries = genEntries();
    var chunks = Object.keys(entries);
    var config = {
    	entry: entries,
    	output: {//在debug模式下，__build目录是虚拟的，webpack的dev server存储在内存里
    		path: path.resolve(debug ? '__build' : assets), //输出路径
            filename: debug ? '[name].js' : 'js/[chunkhash:8].[name].min.js', //压缩后js名字
            chunkFilename: debug ? '[chunkhash:8].chunk.js' : 'js/[chunkhash:8].chunk.min.js', //用于指定非程序入口模块集的文件名称——在output.path指定的路径下
            hotUpdateChunkFilename: debug ?'[id].[chunkhash:8].js' : 'js/[id].[chunkhash:8].min.js',
            publicPath: debug ? '/__build/' : '' //和cdn有关系
    			
    	},
    	resolve: {
            root: [srcDir, './node_modules'], // 将单个目录添加到搜索路径中。 方便搜索
            //alias: sourceMap, //把用户的一个请求重定向到另一个路径 节约时间
            extensions: ['', '.js', '.css', '.scss', '.tpl', '.png', '.jpg'] //可以用来指定模块的后缀，这样在引入模块时就不需要写后缀了，会自动补全
        },
        //IMPORTANT: The loaders here are resolved relative to the resource which they are applied to. 
        //This means they are not resolved relative the the configuration file. 
        //If you have loaders installed from npm and your node_modules folder is not in a parent folder of all source files, webpack cannot find the loader. 
        //You need to add the node_modules folder as absolute path to the resolveLoader.root option. (resolveLoader: { root: path.join(__dirname, "node_modules") })
        resolveLoader: { //Like resolve but for loaders. 例如 style-loader，css-loader 是从node_modules 里面查找的
            root: path.join(__dirname, 'node_modules')
        },
        module: {
        	//noParse: ['zepto'],	//确定一个模块中没有其它新的依赖 就可以配置这项
        	loaders: [
        		{
                    test: /\.(jpe?g|png|gif|svg)$/i,
                    loaders: [
                        'image?{bypassOnDebug: true, progressive:true, \
                            optimizationLevel: 3, pngquant:{quality: "65-80", speed: 4}}',
                        // url-loader更好用，小于10KB的图片会自动转成dataUrl，
                        // 否则则调用file-loader，参数直接传入
                        'url?limit=10000&name=img/[hash:8].[name].[ext]',
                    ]
                },
                {
                    test: /\.(woff|eot|ttf)$/i,
                    loader: 'url?limit=10000&name=fonts/[hash:8].[name].[ext]'
                }
        	]
        },
        plugins: [
            //new ExtractTextPlugin('css/[contenthash:8].[name].min.css', {allChunks: false}), //[contenthash:8]
            new CommonsChunkPlugin({
                name: 'vendors',
                chunks: chunks,
                minChunks: chunks.length // 提取所有chunks共同依赖的模块
            })
        ],
        devServer: { //和本地调试服务配置有关系
            stats: {
                cached: false,
                exclude: excludeFromStats,
                colors: true
            }
        }
    };

    if(debug) {// 开发阶段，css直接内嵌
        var cssLoader = {test: /\.css$/, loader: 'style!css'};
        var sassLoader = {test: /\.scss$/, loader: 'style!css!sass'};

        config.module.loaders.push(cssLoader);
        config.module.loaders.push(sassLoader);
    } else {// 编译阶段，css分离出来单独引入
        var cssLoader = {test: /\.css$/, loader: ExtractTextPlugin.extract("style-loader", "css-loader!autoprefixer-loader")};
        var sassLoader = {test: /\.scss$/, loader: ExtractTextPlugin.extract("style-loader", "css-loader!autoprefixer-loader!sass-loader")};

        config.module.loaders.push(cssLoader);
        config.module.loaders.push(sassLoader);
        config.plugins.push(new ExtractTextPlugin('css/[contenthash:8].[name].min.css', {allChunks: false}));

        // 自动生成入口文件，入口js名必须和入口文件名相同
        // 例如，a页的入口文件是a.html，那么在js目录下必须有一个a.js作为入口文件
        var pages = fs.readdirSync(srcDir);

        pages.forEach(function(filename) {
            var m = filename.match(/(.+)\.html$/);

            if(m) {
                // @see https://github.com/kangax/html-minifier
                var conf = {
                    template: path.resolve(srcDir, filename),
                    filename: filename
                };

                if(m[1] in config.entry) {
                    conf.inject = 'body';
                    conf.chunks = ['vendors', m[1]];
                }
                config.plugins.push(new HtmlWebpackPlugin(conf));
            }
        });
        config.plugins.push(new UglifyJsPlugin());
    }
    return config;
}

/**
 * 获取src js 目录下所有的js 以及js的名
 * @return {[type]} 然后返回一个map 对象
 */
function genEntries() {
    var jsDir = path.resolve(srcDir, 'js');
    var names = fs.readdirSync(jsDir);
    var map = {};

    names.forEach(function(name) {
        var m = name.match(/(.+)\.js$/);
        var entry = m ? m[1] : '';
        var entryPath = entry ? path.resolve(jsDir, name) : '';

        if(entry) map[entry] = entryPath;
    });

    return map;
}

module.exports = makeConf;
