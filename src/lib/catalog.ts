export interface Product {
  id: string;
  brand: string;
  name: string;
  price: number;
  image: string;
  legacyName: string;
  featured?: boolean;
}

export const catalog: Product[] = [
  { id: 'burberry-be3161', brand: 'Burberry', name: 'BE3161 — Light Gold', price: 633, image: "img/products/Burberry/Burberry BE3161/Burberry BE3161 - Light Gold [Brown].png", legacyName: 'Burberry BE3161', featured: true },
  { id: 'oakley-oo9280-bxtr', brand: 'Oakley', name: 'OO9280 BXTR — Clear', price: 242, image: 'img/products/Oakley/Oakley OO9280 BXTR/Oakley OO9280 BXTR - Clear [Blue].png', legacyName: 'Oakley OO9280 BXTR', featured: true },
  { id: 'persol-po3327s', brand: 'Persol', name: 'PO3327S — Black', price: 398, image: 'img/products/Persol/Persol PO3327S - Black [Green].png', legacyName: 'Persol PO3327S', featured: true },
  { id: 'rayban-rb3016-clubmaster', brand: 'Ray-Ban', name: 'RB3016 Clubmaster Classic', price: 230, image: 'img/products/Ray-Ban/Ray-Ban RB3016 Clubmaster Classic/Ray-Ban RB3016 Clubmaster Classic - Black On Gold [Green].png', legacyName: 'Ray-Ban RB3016 Clubmaster Classic', featured: true },
  { id: 'rayban-rb3741-emy', brand: 'Ray-Ban', name: 'RB3741 Emy Bio-Based — Gold', price: 176, image: 'img/products/Ray-Ban/Ray-Ban RB3741 Emy Bio-Based/Ray-Ban RB3741 Emy Bio-Based - Gold [Grey].png', legacyName: 'Ray-Ban RB3741 Emy Bio-Based', featured: true },
  { id: 'rayban-rb3025-aviator', brand: 'Ray-Ban', name: 'RB3025 Aviator Total Black', price: 230, image: 'img/products/Ray-Ban/Ray-Ban RB3025 Aviator/Ray-Ban RB3025 Aviator Total Black - Black [Black-Polarized].png', legacyName: 'Ray-Ban RB3025 Aviator Total Black', featured: true },
  { id: 'giorgio-armani-ar6135', brand: 'Giorgio Armani', name: 'AR6135 — Pale Gold', price: 585, image: 'img/products/Giorgio Armani/Giorgio Armani AR6135/Giorgio Armani AR6135 - Pale Gold [Grey].png', legacyName: 'Giorgio Armani AR6135', featured: true },
  { id: 'burberry-be4291', brand: 'Burberry', name: 'BE4291 — Beige', price: 296, image: 'img/products/Burberry/Burberry BE4291/Burberry BE4291 - Beige [Grey].png', legacyName: 'Burberry BE4291' },
  { id: 'burberry-be4431u', brand: 'Burberry', name: 'BE4431U — Vintage Check', price: 331, image: 'img/products/Burberry/Burberry BE4431U/Burberry BE4431U - Top Black On Vintage Check [Grey-Polarized].png', legacyName: 'Burberry BE4431U' },
  { id: 'oakley-oo9406-sutro', brand: 'Oakley', name: 'OO9406 Sutro — Black Ink', price: 192, image: 'img/products/Oakley/Oakley OO9406 Sutro/Oakley OO9406 Sutro - Black Ink [Green].png', legacyName: 'Oakley OO9406 Sutro' },
  { id: 'oakley-oo9404-latch-panel', brand: 'Oakley', name: 'OO9404 Latch Panel — Grey Smoke', price: 220, image: 'img/products/Oakley/Oakley OO9404 Latch™ Panel/Oakley OO9404 Latch™ Panel - Grey Smoke [Gold].png', legacyName: 'Oakley OO9404 Latch™ Panel' },
  { id: 'rayban-rb3569', brand: 'Ray-Ban', name: 'RB3569 — Black on Silver', price: 216, image: 'img/products/Ray-Ban/Ray-Ban RB3569/Ray-Ban RB3569 - Black On Silver [Grey] 1.png', legacyName: 'Ray-Ban RB3569' },
  { id: 'rayban-rb3686-chromance', brand: 'Ray-Ban', name: 'RB3686 Chromance — Black', price: 268, image: 'img/products/Ray-Ban/Ray-Ban RB3686 Chromance/Ray-Ban RB3686 Chromance - Black [Grey-Polarized].png', legacyName: 'Ray-Ban RB3686 Chromance' },
  { id: 'versace-ve2258', brand: 'Versace', name: 'VE2258 — Dark Grey', price: 392, image: 'img/products/Versace/Versace VE2258/Versace VE2258 - Dark Grey [Grey].png', legacyName: 'Versace VE2258' },
  { id: 'versace-ve43921', brand: 'Versace', name: 'VE43921 — Black', price: 363, image: 'img/products/Versace/Versace VE43921/Versace VE43921 - Black [Grey].png', legacyName: 'Versace VE43921' },
  { id: 'versace-ve4461', brand: 'Versace', name: 'VE4461 — Black', price: 434, image: 'img/products/Versace/Versace VE4461/Versace VE4461 - Black [Grey].png', legacyName: 'Versace VE4461' },
];

export const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

export const normalizeProductName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '');
