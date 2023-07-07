// для установки всех пакетов из package.json команда npm i -D
// для билда команда npx gulp build
// для генерации шрифтов команда npx gulp fontsStyle

// нельзя оставлять пустые теги <img>, иначе будет ошибка TypeError in plugin 'gulp-webp-css'

const src_folder = "src";
const out_folder = "dist";
// scss файл для подключения шрифтов
const fontsScssFile = src_folder + '/scss/_fonts.scss';

const path = {
    src: {
        html: [src_folder + "/*.html", "!" + src_folder + "/_*.html"],
        css: src_folder + "/scss/style.scss",
        js: src_folder + "/js/main.js",
        img: src_folder + "/img/**/*.{jpg,png,gif,ico,webp}",
        svg: src_folder + "/img/**/*.svg",
        fonts: src_folder + "/fonts/*.ttf"
    },
    out: {
        html: out_folder + "/",
        css: out_folder + "/css/",
        js: out_folder + "/js/",
        img: out_folder + "/img/",
        svg: out_folder + "/img/",
        fonts: out_folder + "/fonts/"
    },
    watch: {
        html: src_folder + "/**/*.html",
        css: src_folder + "/scss/**/*.scss",
        js: src_folder + "/js/**/*.js",
        img: src_folder + "/img/**/*.{jpg,png,gif,ico,webp}"
    },
    clean: "./" + out_folder + "/"
}

import gulp from 'gulp';
import fs from 'fs';

import browserSyncPlugin from 'browser-sync';
import fileIncludePlugin from 'gulp-file-include';
import del from 'del';
import renamePlugin from 'gulp-rename';
import dartSass from 'sass';
import gulpSass from 'gulp-sass';
const scssPlugin = gulpSass(dartSass);
import autoprefixerPlugin from 'gulp-autoprefixer';
import groupMediaPlugin from 'gulp-group-css-media-queries';
import cleanCssPlugin from 'gulp-clean-css';
import uglifyPlugin from 'gulp-uglify-es';
import imageminPlugin from 'gulp-imagemin';
import webpPlugin from 'gulp-webp';
import webpHtmlPlugin from 'gulp-webp-html'; // формирует код для изображений webp в html файлах
import webpCssPlugin from 'gulp-webpcss'; // формирует код для изображений webp в css файлах
import svgSpritePlugin from 'gulp-svg-sprite';
import ttf2woff from 'gulp-ttf2woff'; // для преобразования шрифтов ttf -> woff
import ttf2woffTwoPlugin from 'gulp-ttf2woff2'; // для преобразования шрифтов ttf -> woff2
import fonterPlugin from 'gulp-fonter'; // для преобразования шрифтов otf -> ttf
import verNumberPlugin from 'gulp-version-number'; // для добавления версии к css и js файлам, чтобы сбрасывать кеш при ребилде
import newerPlugin from 'gulp-newer'; // проверяет обновился ли файл, чтобы не ребилдить постоянно (применяем для картинок)
import webpack from "webpack-stream";

// browser sync
function server() {
    browserSyncPlugin.init({
        server: {
            baseDir: "./" + out_folder + "/"
        },
        notify: false
    });
}

function html() {
    return gulp.src(path.src.html)
        // сборка html файла с инклудами
        .pipe(fileIncludePlugin())
        // оборачиваем <img> в обертку с webp изображением
        .pipe(webpHtmlPlugin())
        // добавляем версию в подключение css и js файлов
        .pipe(verNumberPlugin({
            value: "%DT%",
            append: {
                key: "_v",
                cover: 0,
                to: ["css", "js"]
            }
        }))
        .pipe(gulp.dest(path.out.html))
        .pipe(browserSyncPlugin.stream());
}

function css() {
    // проверка существования scss для подключения шрифтов
    // если отсутствует - нужно создать, т.к. иначе будет ошибка импорта в scss
    if (! fs.existsSync(fontsScssFile)) {
        fs.writeFile(fontsScssFile, '', () => {});
    }

    return gulp.src(path.src.css, { sourcemaps: true })
        .pipe(scssPlugin({
            outputStyle: "expanded"
        }))
        // собирает медиа запросы по всему css файлу, группирует и помещает в конец
        .pipe(groupMediaPlugin())
        // изменяет background-image в css, разбивая его на webp и обычные изображения и классы webp и no-webp
        // но эти классы придется проставлять дополнительным js скриптом
        .pipe(webpCssPlugin({
            webpClass: ".webp",
            noWebpClass: ".no-webp"
        }))
        // проставляет вендорные префиксы (для кроссбраузерности)
        .pipe(autoprefixerPlugin({
            grid: true,
            overrideBrowsersList: ["last 5 versions"],
            cascade: true
        }))
        // можно сохранить копию css файла до сжатия еси требуется
        .pipe(gulp.dest(path.out.css))
        // сжимаем
        .pipe(cleanCssPlugin())
        // и сохраняем как *.min.css
        .pipe(renamePlugin({
            extname: ".min.css"
        }))
        .pipe(gulp.dest(path.out.css))
        .pipe(browserSyncPlugin.stream());
}

function images() {
    // svg обрабатываем отдельно от изображений - просто копируем
    gulp.src(path.src.svg)
        .pipe(gulp.dest(path.out.svg));
    // обработка остальных изображений
    return gulp.src(path.src.img)
        // обрабатываем только изменившиеся изображения
        .pipe(newerPlugin(path.out.img))
        // сначала создаем webp вариант всех картинок и сохраняем
        .pipe(webpPlugin({
            quality: 70
        }))
        .pipe(gulp.dest(path.out.img))
        // далее опять идем в папку с изображениями и проходим их повторно, сжимая и копируя в dist
        .pipe(gulp.src(path.src.img))
        // обрабатываем только изменившиеся изображения
        .pipe(newerPlugin(path.out.img))
        // уменьшение размера изображения
        .pipe(imageminPlugin({
            progressive: true,
            svgoPlugins: [{ removeViewBox: false }],
            interlaced: true,
            optimizationLevel: 3 // возможные значения from 0 to 7
        }))
        .pipe(gulp.dest(path.out.img))
        .pipe(browserSyncPlugin.stream());
}

function js() {
    return gulp.src(path.src.js)
        /*.pipe(fileIncludePlugin())
        .pipe(gulp.dest(path.out.js))
        // минификация
        .pipe(uglifyPlugin())
        .pipe(renamePlugin({
            extname: ".min.js"
        }))
        .pipe(gulp.dest(path.out.js))*/
        .pipe(webpack({
            mode: 'development',
            output: {
                filename: "main.min.js"
            },
            module: {
                rules: [
                    { test: /\.js$|jsx/ },
                    { test: /\.css$/, use: 'css-loader' },
                ]
            }
        }))
        .pipe(gulp.dest(path.out.js))
        .pipe(browserSyncPlugin.stream());
}

// конвертиция шрифтов ttf -> woff и woff2
function makeWoff() {
    // woff
    gulp.src(path.src.fonts)
        .pipe(ttf2woff())
        .pipe(gulp.dest(path.out.fonts));
    // woff2
    return gulp.src(path.src.fonts)
        .pipe(ttf2woffTwoPlugin())
        .pipe(gulp.dest(path.out.fonts));
}

function watchFiles() {
    // param 1 - путь к файлам, за изменением которых нужно следить
    // param 2 - название функции обработчика (без скобок)
    gulp.watch([path.watch.html], html);
    gulp.watch([path.watch.css], css);
    gulp.watch([path.watch.js], js);
    gulp.watch([path.watch.img], images);
}

function clean() {
    return del(path.clean);
}


/* задачи ниже не участвуют в билде, нужно вызывать отдельно */

// берет svg файлы из /src/svg_sprite и сохраняет созданный спрайт в /src/img/svg_sprite.svg
// вынес эту команду в package.json:
// "scripts": {
//     "svg_sprite": "gulp svgSprite"
// }
// и теперь ее можно также запускать: npm run svg_sprite
function svgSprite() {
    return gulp.src(src_folder + "/svg_sprite/*.svg")
        .pipe(svgSpritePlugin({
            mode: {
                // подходящие mode для генерации - symbol и css
                // подробнее про режимы генерации https://habr.com/ru/post/276463/
                css: {
                    sprite: "../svg_sprite.svg",
                    bust: false,
                    example: true // создает рядом html файл с примером использования
                }
            }
        }))
        .pipe(gulp.dest(src_folder + "/img"));
}

// в основном будет работа с шрифтами ttf, но если вдруг понадобится otf
// нужно будет сначала сконвертить его в ttf, запустив этот таск вручную
// шрифт сохранится в папке исходников src
function makeTtf() {
    return gulp.src(src_folder + "/fonts/*.otf")
        .pipe(fonterPlugin({
            formats: ['ttf']
        }))
        .pipe(gulp.dest(src_folder + "/fonts"));
}

// заносит шрифты из папки dist/fonts в файл fontsScssFile, поэтому проект должен быть сбилден
// _fonts.scss будет перезаписан
function fontsStyle(done) {
    // читаем папку с файлами шрифтов в dist
    fs.readdir(path.out.fonts, (err, fontsFiles) => {
        // проверка существования файлов шрифтов
        if (fontsFiles) {
            // если существует scss для подключения шрифтов - удаляем
            if (fs.existsSync(fontsScssFile)) {
                fs.unlink(fontsScssFile, () => {});
            }
            // создаем scss для подключения шрифтов
            fs.writeFile(fontsScssFile, '', () => {});
            // цикл по шрифтам
            let newFileOnly = '';
            for (let i = 0; i < fontsFiles.length; i++) {
                let fontFileName = fontsFiles[i].split('.')[0];
                // записываем уникальные шрифты в scss
                if (newFileOnly !== fontFileName) {
                    let fontNameArr = fontFileName.split('-');
                    let fontName = fontNameArr[0] ? fontNameArr[0] : fontFileName;
                    let fontWeight = 400;
                    let fontWeightStr = fontNameArr[1] ? fontNameArr[1] : fontFileName;
                    // определяем font-weight из имени файла шрифта
                    switch (fontWeightStr.toLowerCase()) {
                        case 'thin': fontWeight = 100; break;
                        case 'extralight': fontWeight = 200; break;
                        case 'light': fontWeight = 300; break;
                        case 'medium': fontWeight = 500; break;
                        case 'semibold': fontWeight = 600; break;
                        case 'bold': fontWeight = 700; break;
                        case 'extrabold': fontWeight = 800; break;
                        case 'black': fontWeight = 900; break;
                    }
                    // записываем font-face для шрифта в scss
                    let fontFaceStr = `@font-face {\n\tfont-family: "${fontName}";\n\tfont-display: swap;\n\tsrc: url("../fonts/${fontFileName}.woff") format("woff"), url("../fonts/${fontFileName}.woff2") format("woff2");\n\tfont-weight: ${fontWeight};\n\tfont-style: normal;\n}\n\n`;
                    fs.appendFile(fontsScssFile, fontFaceStr, () => {});
                    newFileOnly = fontFileName;
                }
            }
        }
    });
    done();
}

const buildFonts = gulp.series(makeTtf, makeWoff, fontsStyle);
const buildCmd = gulp.series(clean, buildFonts, gulp.parallel(html, css, js, images));
const watchCmd = gulp.series(buildCmd, gulp.parallel(watchFiles, server));

/* задачи */

// создает спрайт из svg
gulp.task('svgSprite', svgSprite);
// конвертирует шрифты и перезаписывает файл _fonts.scss
// для добавления шрифтов вручную нужно использовать друго файл, например _fonts_ext.scss
gulp.task('buildFonts', buildFonts);

gulp.task('build', buildCmd)
gulp.task('default', watchCmd)
