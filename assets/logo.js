window.BuzzLogo = {
  v: "31",
  src(variant) {
    const file = variant === "full" ? "public/brand/logo-full.png" : "public/brand/logo-icon.png";
    return `${file}?v=${this.v}`;
  },
  html(variant = "icon") {
    const full = variant === "full";
    const alt = full ? "BuzzBuds" : "";
    return `<span class="bb-logo bb-logo-${full ? "full" : "icon"}"><img src="${this.src(variant)}" alt="${alt}"></span>`;
  },
};
