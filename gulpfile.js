// The require statement tells Node to look into the node_modules folder for a package
// Importing specific gulp API functions lets us write them below as series() instead of gulp.series()
'use strict';

const {
	src,
	dest,
	watch,
	series
} = require('gulp');

const colors = require('ansi-colors');
const browserSync = require('browser-sync').create();
const sass = require('gulp-sass')(require('sass'));
const del = require('del');
const uglify = require('gulp-uglify-es').default;
const print = require('gulp-print').default;
const imageminJpegRecompress = require( 'imagemin-jpeg-recompress' );
const imageminPngquant = require( 'imagemin-pngquant' );
const removeLog = require('gulp-remove-logging');
const htmlreplace = require('gulp-html-replace');
const $ = require('gulp-load-plugins')();
const log = console.log;

// Browsers you care about for autoprefixing. https://github.com/ai/browserslist
const AUTOPREFIXER_BROWSERS = [
	'last 2 version',
	'> 1%',
	'ie >= 9',
	'ie_mob >= 10',
	'ff >= 30',
	'chrome >= 34',
	'safari >= 7',
	'opera >= 23',
	'ios >= 7',
	'android >= 4',
	'bb >= 10'
];

/**
 * Error Handler for gulp-plumber
 */
function errorHandler(err) {
	console.error(err);
	this.emit('end');
}

// ------------ DEVELOPMENT TASKS -------------

// USING PUG, TEMPLATE, PAGE AND PARTIAL FILES ARE COMBINED TO FORM HTML MARKUP
function compileHTML() {
	return src(['*.pug', 'docs/*.pug'], {
		cwd: 'src',
	})
	.pipe($.plumber({ errorHandler }))
	.pipe($.changed('dist', { extension: '.html' }))
	.pipe($.pugInheritance({ basedir: 'src', skip: ['node_modules'] }))
	.pipe(print(filepath => `Processing: ${filepath}`))
	.pipe($.pug())
	.pipe($.plumber.stop())
	.pipe($.prettyHtml({
		indent_size: 4,
		indent_char: ' ',
		unformatted: ['code', 'pre', 'em', 'strong', 'span', 'i', 'b', 'br']
	}))
	.pipe(dest('dist'))
	.on('end', function () {
		browserSync.reload();
	});
}

// COPY AND TRANSPILE CUSTOM JS
function compileJS() {
	return src('src/assets/js/**/*.js')
		.pipe(print(filepath => `Processing: ${filepath}`))
		.pipe($.babel())
		.pipe(dest('dist/assets/js/'))
		.pipe(browserSync.stream());
}

// COMPILE SCSS INTO CSS
function compileSCSS() {
	return src('src/assets/scss/**/!(_)*.scss')
	.pipe(print(filepath => `Processing: ${filepath}`))
	.pipe(sass())
	.pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
	.pipe(dest('dist/assets/css'))
	.pipe(browserSync.stream());
}

// COPY JS VENDOR FILES
function jsVendor() {
	return src([
		'node_modules/jquery/dist/jquery.min.js',
		'node_modules/swiper/swiper-bundle.js',
		'node_modules/swiper/swiper-bundle.js.map',
		'node_modules/isotope-layout/dist/isotope.pkgd.js',
		'node_modules/jarallax/dist/jarallax.js',
		'node_modules/jarallax/dist/jarallax-element.js',
		'node_modules/jarallax/dist/jarallax.js.map',
		'node_modules/jarallax/dist/jarallax-element.js.map',
		'node_modules/magnific-popup/dist/jquery.magnific-popup.js',
		'node_modules/imagesloaded/imagesloaded.pkgd.js',
		'node_modules/object-fit-images/dist/ofi.js',
		'node_modules/jquery-countdown/dist/jquery.countdown.js',
		'node_modules/bootstrap/dist/js/bootstrap.js',
		'node_modules/bootstrap/dist/js/bootstrap.js.map',
		'node_modules/gist-embed/dist/gist-embed.min.js',
		'node_modules/jquery-inview/jquery.inview.js'
	])
	.pipe($.plumber({ errorHandler }))
	.pipe(dest('dist/assets/vendors/js'))
	.pipe(browserSync.stream());
}

// COPY CSS VENDOR FILES
function cssVendor() {
	return src([
		'node_modules/bootstrap/dist/css/bootstrap.css',
		'node_modules/swiper/swiper-bundle.css',
		'node_modules/magnific-popup/dist/magnific-popup.css',
	])
	.pipe($.plumber({ errorHandler }))
	.pipe(dest('dist/assets/vendors/css'))
	.pipe(browserSync.stream());
}

// SCSS LINT
function scssLint() {
	return src('src/assets/scss/**/*.scss')
	.pipe($.sassLint({
		configFile: '.scss-lint.yml'
	}))
	.pipe($.sassLint.format())
	.pipe($.sassLint.failOnError());
}

// HTML LINTER
function htmlLint() {
	return src('dist/**/*.html')
	.pipe($.htmllint({}, htmllintReporter));
}

function htmllintReporter(filepath, issues) {
	if (issues.length > 0) {
		issues.forEach(function (issue) {
			log(colors.cyan('[gulp-htmllint] ') + colors.white(filepath + ' [' + issue.line + ']: ') + colors.red('(' + issue.code + ') ' + issue.msg));
		});
		process.exitCode = 1;
	} else {
		print('---------------NO HTML LINT ERROR---------------');
	}
}

// JS LINTER
function jsLint() {
	return src('src/assets/js/*.js')
	.pipe($.jshint())
	.pipe($.jshint.reporter('default'));
}

// WATCH FILES
function watchFiles() {
	watch('src/**/*.pug', compileHTML);
	watch('src/assets/scss/**/*.scss', compileSCSS);
	watch('src/assets/js/**/*.js', compileJS);
	watch('src/assets/img/**/*', copyImages);
}

// BROWSER SYNC
function browserSyncInit(done) {
	browserSync.init({
		server: './dist'
	});
	return done();
}

// ------------ OPTIMIZATION TASKS -------------

// COPIES AND MINIFY IMAGE TO DIST
function copyImages() {
	return src('src/assets/img/**/*.{jpg,png,svg}')
	.pipe($.plumber({ errorHandler }))
	.pipe($.newer('dist/assets/img/'))
	.pipe($.imagemin([
		imageminJpegRecompress( {
			progressive: true,
			max: 90,
			min: 80,
		}),
		imageminPngquant({
			quality: [0.8, 0.9]
		}),
	]))
	.pipe(dest('dist/assets/img/'))
	.pipe(browserSync.stream());
}

// PLACES FONT FILES IN THE DIST FOLDER
function copyFont() {
	return src('src/assets/font/*')
	.pipe($.plumber({ errorHandler }))
	.pipe(dest('dist/assets/fonts'))
	.pipe(browserSync.stream());
}

// DELETE DIST FOLDER
function cleanDist(done) {
	del.sync('dist');
	return done();
}

// ACCESSIBILITY CHECK
function HTMLAccessibility() {
	return src('dist/**/*.html')
	.pipe($.accessibility({
		force: true
	}))
	.on('error', console.log)
	.pipe($.accessibility.report({
		reportType: 'txt'
	}))
	.pipe($.rename({
		extname: '.txt'
	}))
	.pipe(dest('accessibility-reports'));
}

// ------------ PRODUCTION TASKS -------------

// CHANGE TO MINIFIED VERSIONS OF JS AND CSS
function renameSources() {
	return src('dist/**/*.html')
	.pipe($.plumber({ errorHandler }))
	.pipe(htmlreplace({
		'js': 'assets/js/main.min.js',
		'css': 'assets/css/main.min.css'
	}))
	.pipe(dest('dist/'));
}

// CONCATINATE JS SCRIPTS
function concatScripts() {
	return src([
		'dist/assets/vendors/js/bootstrap.js',
		'dist/assets/vendors/js/imagesloaded.pkgd.js',
		'dist/assets/vendors/js/isotope.pkgd.js',
		'dist/assets/vendors/js/jarallax.js',
		'dist/assets/vendors/js/jarallax-element.js',
		'dist/assets/vendors/js/jquery.countdown.js',
		'dist/assets/vendors/js/jquery.magnific-popup.js',
		'dist/assets/vendors/js/ofi.js',
		'dist/assets/vendors/js/swiper-bundle.js',
		'dist/assets/vendors/js/gist-embed.min.js',
		'dist/assets/vendors/js/jquery.inview.js',
		'src/assets/js/*',
		'src/assets/js/controllers/*'
	])
	.pipe($.sourcemaps.init())
	.pipe($.concat('main.js'))
	.pipe($.sourcemaps.write('./'))
	.pipe(dest('dist/assets/js'))
	.pipe(browserSync.stream());
}

// MINIFY SCRIPTS
function minifyScripts() {
	return src('dist/assets/js/main.js')
	.pipe(removeLog())
	.pipe($.removeCode({
		production: true
	}))
	.pipe(uglify())
	.pipe($.rename('main.min.js'))
	.pipe(dest('dist/assets/js'));
}

// MINIFY AND CONCAT CSS
function minifyCSS() {
	return src([
		'dist/assets/vendors/css/**/*',
		'dist/assets/css/main.css'
	])
	.pipe($.sourcemaps.init())
	.pipe($.concat('main.css'))
	.pipe($.sourcemaps.write('./'))
	.pipe($.cssmin())
	.pipe($.rename('main.min.css'))
	.pipe(dest('dist/assets/css'));
}

// DEVELOPMENT
exports.development = series(cleanDist, copyFont, copyImages, compileHTML, compileSCSS, cssVendor, jsVendor, compileJS, browserSyncInit, watchFiles);

// PRODUCTION
exports.production = series(cleanDist, copyFont, copyImages, compileHTML, compileSCSS, cssVendor, minifyCSS, jsVendor, concatScripts, minifyScripts, renameSources, browserSyncInit);

// RUN ALL LINTERS
exports.lint = series(htmlLint, scssLint, jsLint);

// RUN ACCESSIBILITY CHECK
exports.a11y = HTMLAccessibility;