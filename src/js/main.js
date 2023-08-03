import { Fancybox } from "@fancyapps/ui";
import { testWebP } from "./webp_detector.js";

// определяет поддержку webp изображений и добавляет класс для body
testWebP((support) => {
    if (support === true) {
        document.querySelector('body').classList.add('webp');
    }
    else{
        document.querySelector('body').classList.add('no-webp');
    }
});

// fancy doc https://fancyapps.com/fancybox/captions/
// swiper doc https://swiperjs.com/
// consider to make a carousel with fancy apps

Fancybox.bind('[data-fancybox="diplomas"]', {});
Fancybox.bind('[data-fancybox="certificates"]', {});


