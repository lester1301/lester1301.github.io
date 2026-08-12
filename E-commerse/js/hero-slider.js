/* =========================
   HERO IMAGE SLIDER
========================= */

const heroSlides =
    document.querySelectorAll(".hero-slide");

const heroImage =
    document.querySelector(".hero-image");


if (heroSlides.length > 1) {

    let currentSlide = 0;


    function showNextSlide() {

        const nextSlide =
            (currentSlide + 1) % heroSlides.length;


        heroSlides[currentSlide]
            .classList.remove("active");

        heroSlides[nextSlide]
            .classList.add("active");


        currentSlide = nextSlide;

    }


    setInterval(
        showNextSlide,
        3000
    );

}