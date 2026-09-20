// Khudkibook Homepage: populates "Popular Subjects" grid from main.json
// Uses CSS-generated book covers when no real image is available.
(function() {
    function hasRealImage(src) {
        if (!src) return false;
        if (/bg\.webp$/.test(src)) return false;
        return true;
    }
    function coverHTML(book) {
        const palettes = [
            'linear-gradient(160deg,#CD5D33 0%,#F8C885 55%,#4A3A2C 140%)',
            'linear-gradient(160deg,#C7643B 0%,#EFAE78 55%,#4A3A2C 140%)',
            'linear-gradient(160deg,#A84E2A 0%,#E3915A 55%,#3E352B 140%)',
            'linear-gradient(160deg,#B9532C 0%,#F0B877 55%,#4A3A2C 140%)',
            'linear-gradient(160deg,#C05A32 0%,#E89A5E 55%,#4A3A2C 140%)'
        ];
        let h = 0;
        for (let i = 0; i < (book.bookName || '').length; i++) h = (h * 31 + (book.bookName || '').charCodeAt(i)) >>> 0;
        const grad = palettes[h % palettes.length];
        const title = (book.bookName || 'GTU Book').split(' ').slice(0, 3).join(' ').toUpperCase();
        return `
            <div class="bookcover" style="background:${grad};height:104px;">
                <div class="bookcover-ribbon" style="top:8px;font-size:0.38rem;width:84px;right:-30px;">GTU Study</div>
                <div class="bookcover-top" style="padding:6px 10px 0;"><span class="bookcover-brand" style="font-size:0.5rem;">KHUDKIBOOK</span></div>
                <div class="bookcover-middle" style="padding:0 10px;"><span class="bookcover-title" style="-webkit-line-clamp:3;font-size:0.85em;">${title}</span>
                <span class="bookcover-meta">${book.bookCode || ''}</span></div>
                <div class="bookcover-bottom" style="padding:0 10px 6px;"><span>FREE PDF</span><span class="bc-rule"></span><span>${book.bookCode || 'GTU'}</span></div>
            </div>`;
    }
    function renderCards(container, items) {
        if (!container || !items) return;
        container.innerHTML = items.slice(0, 8).map(b => `
            <a href="${b.bookLink}" style="text-decoration:none;color:inherit;">
                <div class="abc123456">
                    <div class="i12345">${hasRealImage(b.bookImage) ? `<img style="width:100%;height:100%;object-fit:cover;border-radius:8px;" src="${b.bookImage}" alt="${b.bookName} - GTU Book Cover" loading="lazy" />` : coverHTML(b)}</div>
                    <div class="mali147852">
                        <h1 class="bn159">${b.bookName}</h1>
                        <h1 class="d111">${b.bookCode}</h1>
                        <h1 class="d212">Credit-${b.bookCredit}</h1>
                        <input class="kpb789123" type="button" value="Open">
                    </div>
                </div>
            </a>`).join('');
    }

    function load() {
        const container = document.getElementById("mainbooks");
        if (!container) return;
        fetch("/data/home_books.json")
            .then(r => r.json())
            .then(items => {
                if (Array.isArray(items) && items.length) {
                    renderCards(container, items);
                } else {
                    return fetch("/main.json").then(r => r.json()).then(data => {
                        const home = data.home || (data.it || []).slice(0, 8);
                        renderCards(container, home);
                    });
                }
            })
            .catch(() => {});
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load);
    } else {
        load();
    }
})();
