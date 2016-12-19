var batch = require('gulp-batch');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var concat = require('gulp-concat');
var concatCss = require('gulp-concat-css');
var fs = require('fs');
var gulp = require('gulp');
var jade = require('gulp-pug');
var merge = require('merge-stream');
var mkdirp = require('mkdirp');
var source = require('vinyl-source-stream');
var stylus = require('gulp-stylus');
var templatizer = require('puglatizer');
var watch = require('gulp-watch');
var gitrev = require('git-rev');
var webpack = require("webpack-stream");
var gutil = require("gulp-util");

function getConfig() {
    var config = fs.readFileSync('./dev_config.json');
    return JSON.parse(config);
}

gulp.task('compile', ['resources', 'client', 'config', 'manifest']);

gulp.task('watch', function () {
    watch([
        './src/**',
        '!./src/js/templates.js',
        './dev_config.json'
    ], batch(function (events, done) {
        console.log('==> Recompiling Kaiwa');
        gulp.start('compile', done);
    }));
});

gulp.task('resources', function () {
    return gulp.src('./src/resources/**')
        .pipe(gulp.dest('./public'));
});

gulp.task('client', ['jade-templates', 'jade-views'], function (cb) {
    webpack(Object.assign({
            plugins: []
        }, require('./webpack.config.js')), null, function(err, stats) {
            if(err) return cb(JSON.stringify(err));
            gutil.log("[webpack]", stats.toString());
            return stats;
        })
        .pipe(gulp.dest('./public/js'))
        .on('end', cb);
});

gulp.task('config', function (cb) {
    var config = getConfig();
    gitrev.short(function (commit) {
        config.server.softwareVersion = {
            "name": config.server.name,
            "version": commit
        }
        config.server.baseUrl = config.http.baseUrl
        mkdirp('./public', function (error) {
            if (error) {
                cb(error);
                return;
            }
            fs.writeFile(
                './public/config.js',
                'var SERVER_CONFIG = ' + JSON.stringify(config.server) + ';',
                cb);
        });
    })
});

gulp.task('manifest', function (cb) {
    var pkg = require('./package.json');
    var config = getConfig();

    fs.readFile('./src/manifest/manifest.cache', 'utf-8', function (error, content) {
        if (error) {
            cb(error);
            return;
        }

        mkdirp('./public', function (error) {
            if (error) {
                cb(error);
                return;
            }

            var manifest = content.replace(
                '#{version}',
                 pkg.version + config.isDev ? ' ' + Date.now() : '');
            fs.writeFile('./public/manifest.cache', manifest, cb);
        });
    });
});

gulp.task('jade-templates', function (cb) {
    templatizer('./src/jade/templates', './src/js/templates.js',
        {
            pug: {
                basedir: __dirname + '/src/jade/templates'
            }
        },
        cb);
});

gulp.task('jade-views', ['css'], function () {
    var config = getConfig();
    return gulp.src([
        './src/jade/views/*',
        '!./src/jave/views/layout.pug'
    ])
        .pipe(jade({
            locals: {
                config: config
            }
        }))
        .pipe(gulp.dest('./public/'));
});

gulp.task('css', ['stylus'], function () {
    return gulp.src([
            './build/css/*.css',
            './src/css/*.css'
        ])
        .pipe(concatCss('app.css'))
        .pipe(gulp.dest('./public/css/'));
});

gulp.task('stylus', function () {
    return gulp.src('./src/stylus/client.styl')
        .pipe(stylus())
        .pipe(gulp.dest('./build/css'));
});
