/*
  Usage:
  1. npm install // To install all dev dependencies of package
  2. npm run dev // To start development and server for live preview
  3. npm run prod // To generate minified files for live server
*/

const { src, dest, task, watch, series, parallel } = require("gulp");
const options = require("./config"), // paths and other options from config.js
    clean = require("gulp-clean"), // For Cleaning build/src for fresh export
    browserSync = require("browser-sync").create(),
    sass = require("gulp-sass")(require("sass")), //For Compiling SASS files
    concat = require("gulp-concat"), // For Concatenating js,css files
    uglify = require("gulp-terser"), // To Minify JS files
    imagemin = require("gulp-imagemin"), // To Optimize Images
    cleanCSS = require("gulp-clean-css"), // To Minify CSS files
    purgeCss = require("gulp-purgecss"), // Remove Unused CSS from Styles
    logSymbols = require("log-symbols"), // For Symbolic Console logs
    includePartials = require("gulp-file-include"), // For supporting partials if required
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    gcmq = require('gulp-group-css-media-queries'),
    autoprefixer = require('gulp-autoprefixer');

// метка времени для добавления к именам файлов
let timestamp;

//Load Previews on Browser on dev
function livePreview(done) {
    browserSync.init({
        server: {
            baseDir: options.paths.dist.base,
        },
        port: options.config.port || 5000,
        notify: false,
    });
    done();
}

// Triggers Browser reload
function previewReload(done) {
    console.log("\n\t" + logSymbols.info, "Reloading Browser Preview.\n");
    browserSync.reload();
    done();
}

// setup current timestamp for cache busting
function genTimestamp(done) {
    timestamp = new Date().getTime();
    done();
}

//Development Tasks
function devHTML() {
    return src(`${options.paths.src.base}/**/*.html`)
        .pipe(includePartials())
        .pipe(dest(options.paths.dist.base));
}

function devStyles() {
    return src(`${options.paths.src.css}/**/*.scss`)
        .pipe(sass().on("error", sass.logError))
        .pipe(gcmq())
        .pipe(autoprefixer())
        .pipe(concat({ path: "style.css" }))
        .pipe(rename({extname: '.min.css'}))
        .pipe(dest(options.paths.dist.css));
}

function devScripts() {
    return src([
            `${options.paths.src.js}/libs/**/*.js`,
            `${options.paths.src.js}/**/*.js`,
            `!${options.paths.src.js}/**/external/*`,
        ])
        .pipe(concat({ path: "scripts.js" }))
        .pipe(dest(options.paths.dist.js));
}

function devImages() {
    return src(`${options.paths.src.img}/**/*`).pipe(
        dest(options.paths.dist.img)
    );
}

function watchFiles() {
    watch(
        `${options.paths.src.base}/**/*.{html,php}`,
        series(devHTML, devStyles, previewReload)
    );
    watch(
        `${options.paths.src.css}/**/*.scss`,
        series(devStyles, previewReload)
    );
    watch(`${options.paths.src.js}/**/*.js`, series(devScripts, previewReload));
    watch(`${options.paths.src.img}/**/*`, series(devImages, previewReload));
    console.log("\n\t" + logSymbols.info, "Watching for Changes..\n");
}

function devClean() {
    console.log(
        "\n\t" + logSymbols.info,
        "Cleaning src folder for fresh start.\n"
    );
    return src(options.paths.dist.base, { read: false, allowEmpty: true }).pipe(
        clean()
    );
}

//Production Tasks (Optimized Build for Live/Production Sites)
function prodHTML() {
    return src([
            `${options.paths.src.base}/**/*.{html,php}`,
            `!${options.paths.src.base}/partials/*`
        ])
        .pipe(includePartials())
        .pipe(replace(/style.min.css/g, 'style-' + timestamp + '.min.css'))
        .pipe(dest(options.paths.build.base));
}

function prodStyles() {
    return src(`${options.paths.dist.css}/**/*`)
        .pipe(gcmq())
        .pipe(autoprefixer())
        .pipe(
            purgeCss({
                content: ["src/**/*.{html,js,php}"],
                defaultExtractor: (content) => {
                    const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
                    const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
                    return broadMatches.concat(innerMatches);
                },
            })
        )
        .pipe(cleanCSS({ compatibility: "ie8" }))
        .pipe(rename((path) => {
            path.basename = "style";
            path.extname = "-" + timestamp + ".min.css";
        }))
        .pipe(dest(options.paths.build.css));
}

function prodScripts() {
    return src([
            `${options.paths.src.js}/libs/**/*.js`,
            `${options.paths.src.js}/**/*.js`,
        ])
        .pipe(concat({ path: "scripts.js" }))
        .pipe(uglify())
        .pipe(dest(options.paths.build.js));
}

function prodImages() {
    return src(options.paths.src.img + "/**/*")
        .pipe(imagemin())
        .pipe(dest(options.paths.build.img));
}

function prodClean() {
    console.log(
        "\n\t" + logSymbols.info,
        "Cleaning build folder for fresh start.\n"
    );
    return src(options.paths.build.base, { read: false, allowEmpty: true }).pipe(
        clean()
    );
}

function buildFinish(done) {
    console.log(
        "\n\t" + logSymbols.info,
        `Production build is complete. Files are located at ${options.paths.build.base}\n`
    );
    done();
}

exports.default = series(
    devClean, // Clean Dist Folder
    parallel(devStyles, devScripts, devImages, devHTML), //Run All tasks in parallel
    livePreview, // Live Preview Build
    watchFiles // Watch for Live Changes
);

exports.prod = series(
    prodClean, // Clean Build Folder
    genTimestamp,
    parallel(prodStyles, prodScripts, prodImages, prodHTML), //Run All tasks in parallel
    buildFinish
);
