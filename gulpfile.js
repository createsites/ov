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

const {src, dest} = require('gulp');
const gulp = require('gulp');
const fs = require('fs');

const browserSyncPlugin = require('browser-sync').create();
const fileIncludePlugin = require('gulp-file-include');
const delPlugin = require('del');
const renamePlugin = require('gulp-rename');
const scssPlugin = require('gulp-sass')(require('sass'));
const autoprefixerPlugin = require('gulp-autoprefixer');
const groupMediaPlugin = require('gulp-group-css-media-queries');
const cleanCssPlugin = require('gulp-clean-css');
const uglifyPlugin = require('gulp-uglify-es').default;
const imageminPlugin = require('gulp-imagemin');
const webpPlugin = require('gulp-webp');
const webpHtmlPlugin = require('gulp-webp-html'); // формирует код для изображений webp в html файлах
const webpCssPlugin = require('gulp-webpcss'); // формирует код для изображений webp в css файлах
const svgSpritePlugin = require('gulp-svg-sprite');
const ttf2woff = require('gulp-ttf2woff'); // для преобразования шрифтов ttf -> woff
const ttf2woffTwoPlugin = require('gulp-ttf2woff2'); // для преобразования шрифтов ttf -> woff2
const fonterPlugin = require('gulp-fonter'); // для преобразования шрифтов otf -> ttf
const verNumberPlugin = require('gulp-version-number'); // для добавления версии к css и js файлам, чтобы сбрасывать кеш при ребилде
const newerPlugin = require('gulp-newer'); // проверяет обновился ли файл, чтобы не ребилдить постоянно (применяем для картинок)

// browser sync
function bs() {
    browserSyncPlugin.init({
        server: {
            baseDir: "./" + out_folder + "/"
        },
        notify: false
    });
}

function html() {
    return src(path.src.html)
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
        .pipe(dest(path.out.html))
        .pipe(browserSyncPlugin.stream());
}

function css() {
    // проверка существования scss для подключения шрифтов
    // если отсутствует - нужно создать, т.к. иначе будет ошибка импорта в scss
    if (! fs.existsSync(fontsScssFile)) {
        fs.writeFile(fontsScssFile, '', () => {});
    }

    return src(path.src.css, { sourcemaps: true })
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
        .pipe(dest(path.out.css))
        // сжимаем
        .pipe(cleanCssPlugin())
        // и сохраняем как *.min.css
        .pipe(renamePlugin({
            extname: ".min.css"
        }))
        .pipe(dest(path.out.css))
        .pipe(browserSyncPlugin.stream());
}

function images() {
    // svg обрабатываем отдельно от изображений - просто копируем
    src(path.src.svg)
        .pipe(dest(path.out.svg));
    // обработка остальных изображений
    return src(path.src.img)
        // обрабатываем только изменившиеся изображения
        .pipe(newerPlugin(path.out.img))
        // сначала создаем webp вариант всех картинок и сохраняем
        .pipe(webpPlugin({
            quality: 70
        }))
        .pipe(dest(path.out.img))
        // далее опять идем в папку с изображениями и проходим их повторно, сжимая и копируя в dist
        .pipe(src(path.src.img))
        // обрабатываем только изменившиеся изображения
        .pipe(newerPlugin(path.out.img))
        // уменьшение размера изображения
        .pipe(imageminPlugin({
            progressive: true,
            svgoPlugins: [{ removeViewBox: false }],
            interlaced: true,
            optimizationLevel: 3 // возможные значения from 0 to 7
        }))
        .pipe(dest(path.out.img))
        .pipe(browserSyncPlugin.stream());
}

function js() {
    return src(path.src.js)
        .pipe(fileIncludePlugin())
        .pipe(dest(path.out.js))
        // минификация
        .pipe(uglifyPlugin())
        .pipe(renamePlugin({
            extname: ".min.js"
        }))
        .pipe(dest(path.out.js))
        .pipe(browserSyncPlugin.stream());
}

// конвертиция шрифтов ttf -> woff и woff2
function makeWoff() {
    // woff
    src(path.src.fonts)
        .pipe(ttf2woff())
        .pipe(dest(path.out.fonts));
    // woff2
    return src(path.src.fonts)
        .pipe(ttf2woffTwoPlugin())
        .pipe(dest(path.out.fonts));
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
    return delPlugin(path.clean);
}


/* задачи ниже не участвуют в билде, нужно вызывать отдельно */

// берет svg файлы из /src/svg_sprite и сохраняет созданный спрайт в /src/img/svg_sprite.svg
// вынес эту команду в package.json:
// "scripts": {
//     "svg_sprite": "gulp svgSprite"
// }
// и теперь ее можно также запускать: npm run svg_sprite
function svgSprite() {
    return src(src_folder + "/svg_sprite/*.svg")
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
        .pipe(dest(src_folder + "/img"));
}

// в основном будет работа с шрифтами ttf, но если вдруг понадобится otf
// нужно будет сначала сконвертить его в ttf, запустив этот таск вручную
// шрифт сохранится в папке исходников src
function makeTtf() {
    return src(src_folder + "/fonts/*.otf")
        .pipe(fonterPlugin({
            formats: ['ttf']
        }))
        .pipe(dest(src_folder + "/fonts"));
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
const watchCmd = gulp.series(buildCmd, gulp.parallel(watchFiles, bs));

/* задачи */

// создает спрайт из svg
exports.svgSprite = gulp.task('svgSprite', svgSprite);
// конвертирует шрифты и перезаписывает файл _fonts.scss
// для добавления шрифтов вручную нужно использовать друго файл, например _fonts_ext.scss
exports.buildFonts = buildFonts;

exports.build = buildCmd;
exports.serve = watchCmd;
exports.default = watchCmd;
