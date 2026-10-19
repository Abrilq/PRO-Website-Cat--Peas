import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { catalog, formatPrice, normalizeProductName } from './lib/catalog';
import type { Product } from './lib/catalog';
import { supabase } from './lib/supabase';

type CartLine = { productId: string; quantity: number };
type StoreContextValue = {
  products: Product[];
  cart: CartLine[];
  user: User | null;
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  storeError: string;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Store context is not available.');
  return store;
}

function readCart(): CartLine[] {
  const saved = localStorage.getItem('catpeas-cart');
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (line): line is CartLine =>
      typeof line === 'object' &&
      line !== null &&
      typeof line.productId === 'string' &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0,
  );
}

function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(catalog);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [user, setUser] = useState<User | null>(null);
  const [storeError, setStoreError] = useState('');

  useEffect(() => {
    localStorage.setItem('catpeas-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    const loadProducts = async () => {
      const { data, error } = await client
        .from('products')
        .select('id, brand, name, price, image, legacy_name, featured')
        .eq('active', true)
        .order('brand');
      if (!active) return;
      if (error) {
        setStoreError(`We couldn't load the live catalog: ${error.message}`);
        return;
      }
      if (data?.length) {
        setProducts(data.map((row) => ({
          id: row.id,
          brand: row.brand,
          name: row.name,
          price: Number(row.price),
          image: row.image,
          legacyName: row.legacy_name,
          featured: row.featured,
        })));
      }
    };

    void loadProducts();
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStoreError(`We couldn't restore your session: ${error.message}`);
        return;
      }
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ products, cart, user, setCart, storeError }),
    [products, cart, user, storeError],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function Icon({ name }: { name: 'search' | 'bag' | 'user' | 'arrow' | 'close' | 'menu' | 'plus' | 'minus' | 'trash' }) {
  const paths: Record<typeof name, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Header() {
  const { cart, user } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const count = cart.reduce((total, line) => total + line.quantity, 0);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/shop?search=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  };

  return (
    <header className="site-header">
      <div className="announcement">Complimentary shipping on every order <span>·</span> A little sunshine, delivered</div>
      <div className="header-inner">
        <button className="icon-button mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        <Link className="wordmark" to="/" aria-label="Cat'Peas home"><span className="brand-symbol">c</span>cat'peas<span className="wordmark-dot">.</span></Link>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          <Link to="/shop">Shop all</Link>
          <Link to="/shop?collection=best">Best sellers</Link>
          <Link to="/about">Our story</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button search-trigger" aria-label="Search products" onClick={() => setSearchOpen(!searchOpen)}><Icon name="search" /></button>
          <Link className="icon-button account-trigger" to={user ? '/account' : '/login'} aria-label="Your account"><Icon name="user" /></Link>
          <Link className="icon-button bag-trigger" to="/cart" aria-label={`Shopping bag, ${count} items`}><Icon name="bag" />{count > 0 && <span className="bag-count">{count}</span>}</Link>
        </div>
        {searchOpen && <form className="search-popover" onSubmit={submitSearch}><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find your frames" aria-label="Search products" /><button type="submit" aria-label="Submit search"><Icon name="arrow" /></button></form>}
      </div>
    </header>
  );
}

function Footer() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const subscribe = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    if (!supabase) {
      setNotice('Newsletter sign-up is available after Supabase is connected.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('newsletter_signups').insert({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error) {
      setNotice(error.code === '23505' ? "You're already on the list — thank you!" : `We couldn't save your sign-up: ${error.message}`);
      return;
    }
    setEmail('');
    setNotice("You're on the list. Keep an eye on your inbox!");
  };

  return (
    <footer className="site-footer">
      <div className="newsletter-band">
        <div><span className="eyebrow">A good thing in your inbox</span><h2>Meet your new<br />favorite pair.</h2><p>Fresh arrivals, thoughtful edits, and the occasional sunny surprise.</p></div>
        <form onSubmit={subscribe} className="newsletter-form"><label htmlFor="newsletter-email">Your email address</label><div><input id="newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button className="button button-dark" disabled={busy}>{busy ? 'Joining…' : 'Sign me up'} <Icon name="arrow" /></button></div><span aria-live="polite">{notice}</span></form>
      </div>
      <div className="footer-main">
        <div className="footer-brand"><Link className="wordmark" to="/"><span className="brand-symbol">c</span>cat'peas<span className="wordmark-dot">.</span></Link><p>Good frames. Good days.<br />Made for wherever the light takes you.</p></div>
        <div><h3>Explore</h3><Link to="/shop">Shop all</Link><Link to="/shop?collection=best">Best sellers</Link><Link to="/about">Our story</Link></div>
        <div><h3>Here to help</h3><Link to="/contact">Contact us</Link><Link to="/account">My account</Link><Link to="/cart">Your bag</Link></div>
        <div><h3>Come say hello</h3><a href="mailto:catpeas@gmail.com">catpeas@gmail.com</a><p>182 McArthur Highway<br />Bocaue, Bulacan, Philippines</p></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Cat'Peas. All rights reserved.</span><span>Thoughtfully picked, always.</span></div>
    </footer>
  );
}

function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return (
    <Link to={`/products/${product.id}`} className="product-card" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="product-image-wrap"><img src={`/${product.image}`} alt={`${product.brand} ${product.name}`} loading="lazy" /><span className="card-action"><Icon name="arrow" /></span>{product.featured && <span className="product-tag">{product.brand}</span>}</div>
      <div className="product-card-copy"><div><span className="product-brand">{product.brand}</span><h3>{product.name}</h3></div><span className="product-price">{formatPrice(product.price)}</span></div>
    </Link>
  );
}

function ProductGrid({ items }: { items: Product[] }) {
  return <div className="product-grid">{items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>;
}

function HomePage() {
  const { products, storeError } = useStore();
  const featured = products.filter((product) => product.featured).slice(0, 4);
  return (
    <>
      <section className="hero">
        <div className="hero-content"><span className="eyebrow">Eyewear for the everyday</span><h1>A brighter<br /><em>point of view.</em></h1><p>Thoughtfully chosen frames that feel like you, only in the best light.</p><Link className="button button-dark" to="/shop">Find your frames <Icon name="arrow" /></Link><div className="hero-note"><span>01 / 03</span><span>Lightweight. Timeless. Yours.</span></div></div>
        <div className="hero-art"><img src="/img/wallpaper_homepage_enhanced.jpeg" alt="A warm, sunlit styling of Cat'Peas eyewear" /><div className="hero-stamp">See the<br /><strong>good</strong><br />in every day</div><div className="hero-caption">THE SUN IS ALWAYS IN SEASON</div></div>
        <div className="hero-outline" aria-hidden="true">C</div>
      </section>
      {storeError && <div className="inline-alert" role="status">{storeError}</div>}
      <section className="benefits"><span>Curated with care</span><i>✳</i><span>Free shipping</span><i>✳</i><span>Made for real life</span><i>✳</i><span>Good light, guaranteed</span></section>
      <section className="section featured-section"><div className="section-heading"><div><span className="eyebrow">The Cat'Peas edit</span><h2>Frames with<br /><em>main character energy.</em></h2></div><Link className="text-link" to="/shop">Shop all frames <Icon name="arrow" /></Link></div><ProductGrid items={featured.length ? featured : products.slice(0, 4)} /></section>
      <section className="story-strip"><div className="story-image"><img src="/img/banner/b1.png" alt="A look at the Cat'Peas eyewear collection" loading="lazy" /></div><div className="story-copy"><span className="eyebrow">A little more you</span><h2>Good style should feel <em>like yourself.</em></h2><p>Not a costume. Not a compromise. Just the pair you reach for every morning — and wonder how you ever went without.</p><Link className="text-link" to="/about">Get to know us <Icon name="arrow" /></Link></div></section>
      <section className="quote-section"><span className="eyebrow">A note from us</span><p>“Find your light.<br /><em>Then wear it out.</em>”</p><Link className="button button-outline" to="/shop">Shop the collection <Icon name="arrow" /></Link></section>
    </>
  );
}

function ShopPage() {
  const { products, storeError } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [brand, setBrand] = useState('All frames');
  const query = searchParams.get('search') ?? '';
  const brands = ['All frames', ...Array.from(new Set(products.map((product) => product.brand))).sort()];
  const filtered = products.filter((product) => {
    const matchesQuery = `${product.brand} ${product.name}`.toLowerCase().includes(query.toLowerCase());
    const matchesBrand = brand === 'All frames' || product.brand === brand;
    const matchesCollection = searchParams.get('collection') !== 'best' || product.featured;
    return matchesQuery && matchesBrand && matchesCollection;
  });
  return (
    <main className="page-shell">
      <section className="shop-intro"><span className="eyebrow">A good place to start</span><h1>Find your<br /><em>kind of frame.</em></h1><p>Everyday icons, considered classics, and a little something unexpected.</p></section>
      <section className="shop-content"><div className="shop-toolbar"><span>{filtered.length} frames to fall for</span><div className="shop-controls"><label htmlFor="brand-filter">Filter by</label><select id="brand-filter" value={brand} onChange={(event) => setBrand(event.target.value)}>{brands.map((item) => <option key={item}>{item}</option>)}</select><label className="sr-only" htmlFor="shop-search">Search frames</label><input id="shop-search" value={query} onChange={(event) => { const value = event.target.value; setSearchParams(value ? { search: value } : {}); }} placeholder="Search frames" /></div></div>
        {storeError && <div className="inline-alert" role="status">{storeError}</div>}
        {filtered.length ? <ProductGrid items={filtered} /> : <div className="empty-state"><h2>No frames found.</h2><p>Try another search or choose a different brand.</p><button className="text-link" onClick={() => { setBrand('All frames'); setSearchParams({}); }}>Clear filters <Icon name="arrow" /></button></div>}
      </section>
    </main>
  );
}

function ProductPage() {
  const { id } = useParams();
  const { products, setCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const product = products.find((item) => item.id === id);
  if (!product) return <main className="empty-state page-shell"><h1>That frame has wandered off.</h1><Link className="button button-dark" to="/shop">Browse the collection <Icon name="arrow" /></Link></main>;

  const addToBag = () => {
    setCart((current) => {
      const found = current.find((line) => line.productId === product.id);
      return found
        ? current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + quantity } : line)
        : [...current, { productId: product.id, quantity }];
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  };

  return (
    <main className="page-shell product-page">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/shop">Shop</Link><span>/</span><span>{product.brand}</span></div>
      <section className="product-detail"><div className="product-detail-image"><img src={`/${product.image}`} alt={`${product.brand} ${product.name}`} /></div><div className="product-detail-copy"><span className="eyebrow">{product.brand} · The Cat'Peas edit</span><h1>{product.name}</h1><p className="detail-price">{formatPrice(product.price)}</p><p className="detail-description">A forever kind of favorite. Thoughtfully selected for its easy fit, considered details, and the way it makes every ordinary day feel a little brighter.</p><div className="detail-rule" /><label className="quantity-label" htmlFor="quantity">Quantity</label><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Icon name="minus" /></button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(10, quantity + 1))}><Icon name="plus" /></button></div><button className="button button-dark add-button" onClick={addToBag}>{added ? 'Added to your bag ✓' : 'Add to bag'} <Icon name="arrow" /></button><p className="shipping-note">Complimentary shipping · Easy returns</p><details className="product-accordion"><summary>The details <span>+</span></summary><p>Authentic designer eyewear, selected by Cat'Peas. Includes a protective case and cleaning cloth where provided by the brand.</p></details><details className="product-accordion"><summary>Shipping & returns <span>+</span></summary><p>Enjoy complimentary shipping on every order. Need a hand? <Link to="/contact">Get in touch</Link> and our team will help.</p></details></div></section>
      <section className="section related-section"><div className="section-heading"><div><span className="eyebrow">More good things</span><h2>Worth a closer look.</h2></div><Link className="text-link" to="/shop">See everything <Icon name="arrow" /></Link></div><ProductGrid items={products.filter((item) => item.id !== product.id).slice(0, 4)} /></section>
    </main>
  );
}

function AboutPage() {
  return <main className="page-shell editorial-page"><div className="editorial-hero"><span className="eyebrow">A little about us</span><h1>We believe the right pair can change <em>your whole day.</em></h1><p>Cat'Peas is for people who know style isn't about being someone else. It's about feeling more like you.</p></div><div className="editorial-image"><img src="/img/wallpaper_homepage_enhanced_enhanced.jpeg" alt="Sunlight falling over a thoughtfully chosen pair of sunglasses" /></div><section className="editorial-columns"><div><span className="eyebrow">Our point of view</span><h2>Less noise.<br /><em>More you.</em></h2></div><div><p>We bring together eyewear we genuinely love — timeless silhouettes, unexpected details, and frames that work as hard as you do. Every piece in our edit is chosen to be lived in, not just looked at.</p><p>Based in Bocaue, Bulacan, we're here to make finding your next favorite feel personal, easy, and just a little bit joyful.</p><Link className="text-link" to="/shop">Find your frames <Icon name="arrow" /></Link></div></section></main>;
}

function ContactPage() {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    if (!supabase) {
      setNotice('Messages are available after Supabase is connected. Please email catpeas@gmail.com in the meantime.');
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    const { error } = await supabase.from('contact_messages').insert({
      name: String(form.get('name')).trim(),
      email: String(form.get('email')).trim().toLowerCase(),
      subject: String(form.get('subject')).trim(),
      message: String(form.get('message')).trim(),
    });
    setBusy(false);
    if (error) {
      setNotice(`Your message couldn't be sent: ${error.message}`);
      return;
    }
    formElement.reset();
    setNotice('Thanks for saying hello. Our team will be in touch soon.');
  };
  return <main className="page-shell contact-page"><div className="contact-heading"><span className="eyebrow">We're all ears</span><h1>Let's make<br /><em>something good.</em></h1><p>Questions about a frame, an order, or just want to say hi? We'd love to hear from you.</p></div><div className="contact-layout"><form className="contact-form" onSubmit={submitMessage}><div className="form-row"><label>Your name<input name="name" required placeholder="Name" /></label><label>Email address<input name="email" type="email" required placeholder="you@example.com" /></label></div><label>Subject<input name="subject" required placeholder="What can we help with?" /></label><label>Your message<textarea name="message" required rows={5} placeholder="Tell us a little more..." /></label><button className="button button-dark" disabled={busy}>{busy ? 'Sending…' : 'Send your note'} <Icon name="arrow" /></button><p className="form-notice" aria-live="polite">{notice}</p></form><aside className="contact-aside"><span className="eyebrow">Come say hello</span><h2>We're right here.</h2><p>182 McArthur Highway<br />Wakas, Bocaue, Bulacan</p><a href="mailto:catpeas@gmail.com">catpeas@gmail.com</a><a href="tel:+639923893296">+63 992 389 3296</a><span className="contact-hours">Monday – Saturday<br />8:00 AM – 5:00 PM</span></aside></div></main>;
}

function CartPage() {
  const { cart, products, setCart, user } = useStore();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const lines = cart.map((line) => ({ ...line, product: products.find((product) => product.id === line.productId) })).filter((line) => line.product);
  const subtotal = lines.reduce((sum, line) => sum + line.product!.price * line.quantity, 0);
  const updateQuantity = (productId: string, quantity: number) => setCart(cart.map((line) => line.productId === productId ? { ...line, quantity } : line));

  const checkout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setNotice('Connect Supabase to place an order.');
      return;
    }
    if (!user) {
      navigate('/login?returnTo=%2Fcart');
      return;
    }
    const form = new FormData(event.currentTarget);
    const address = {
      name: String(form.get('name')).trim(),
      email: user.email,
      phone: String(form.get('phone')).trim(),
      street: String(form.get('street')).trim(),
      city: String(form.get('city')).trim(),
      region: String(form.get('region')).trim(),
      postal_code: String(form.get('postal_code')).trim(),
      country: 'Philippines',
    };
    setBusy(true);
    const { error } = await supabase.rpc('create_order', {
      order_address: address,
      order_items: lines.map((line) => ({ product_id: line.product!.id, quantity: line.quantity })),
    });
    setBusy(false);
    if (error) {
      setNotice(`We couldn't place your order: ${error.message}`);
      return;
    }
    setCart([]);
    setCheckoutOpen(false);
    setNotice('Your order request is in. You can find its details in your account.');
  };

  return <main className="page-shell cart-page"><div className="page-heading"><span className="eyebrow">Your good things</span><h1>Your bag<span className="heading-period">.</span></h1><Link className="text-link" to="/shop">Keep looking <Icon name="arrow" /></Link></div>
    {!lines.length ? <div className="empty-state cart-empty"><div className="empty-bag"><Icon name="bag" /></div><h2>Your bag is taking a little breather.</h2><p>Find something that feels like you.</p><Link className="button button-dark" to="/shop">Shop the collection <Icon name="arrow" /></Link></div> : <div className="cart-layout"><div className="cart-lines">{lines.map(({ product, quantity }) => <article className="cart-line" key={product!.id}><Link to={`/products/${product!.id}`} className="cart-line-image"><img src={`/${product!.image}`} alt={`${product!.brand} ${product!.name}`} /></Link><div className="cart-line-info"><span className="product-brand">{product!.brand}</span><Link to={`/products/${product!.id}`}><h2>{product!.name}</h2></Link><span>{formatPrice(product!.price)}</span><div className="cart-line-controls"><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => updateQuantity(product!.id, Math.max(1, quantity - 1))}><Icon name="minus" /></button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => updateQuantity(product!.id, Math.min(10, quantity + 1))}><Icon name="plus" /></button></div><button className="remove-button" onClick={() => setCart(cart.filter((line) => line.productId !== product!.id))}><Icon name="trash" /> Remove</button></div></div><strong className="line-total">{formatPrice(product!.price * quantity)}</strong></article>)}</div><aside className="order-summary"><span className="eyebrow">The numbers</span><h2>Order summary</h2><div><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div><span>Shipping</span><span>On us</span></div><div className="summary-total"><strong>Total</strong><strong>{formatPrice(subtotal)}</strong></div><button className="button button-dark checkout-button" onClick={() => setCheckoutOpen(true)}>Continue to checkout <Icon name="arrow" /></button><p>Taxes included. Shipping calculated at checkout.</p></aside></div>}
    {notice && <div className="inline-alert" role="status">{notice}</div>}
    {checkoutOpen && <div className="checkout-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}><section className="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="icon-button checkout-close" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)}><Icon name="close" /></button><span className="eyebrow">Almost yours</span><h2 id="checkout-title">Delivery details</h2>{!user && <p className="checkout-hint">Sign in to place an order and keep track of it in your account.</p>}<form className="checkout-form" onSubmit={checkout}><label>Full name<input name="name" required autoComplete="name" /></label><label>Email address<input value={user?.email ?? ''} readOnly type="email" /></label><label>Phone<input name="phone" required type="tel" autoComplete="tel" /></label><label>Street address<input name="street" required autoComplete="street-address" /></label><div className="form-row"><label>City / Municipality<input name="city" required autoComplete="address-level2" /></label><label>Province<input name="region" required defaultValue="Bulacan" /></label></div><label>Postal code<input name="postal_code" required autoComplete="postal-code" /></label><button className="button button-dark" disabled={busy}>{busy ? 'Placing order…' : user ? `Place order · ${formatPrice(subtotal)}` : 'Sign in to continue'} <Icon name="arrow" /></button>{notice && <p className="form-notice" aria-live="polite">{notice}</p>}</form><p className="checkout-hint">This creates an order request. The store will contact you to confirm payment and delivery.</p></section></div>}
  </main>;
}

function AuthPage({ register = false }: { register?: boolean }) {
  const { user } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => { if (user && !register) navigate('/account', { replace: true }); }, [user, navigate, register]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    if (!supabase) {
      setNotice('Account access is ready once Supabase is connected. See the setup guide.');
      return;
    }
    setBusy(true);
    const result = register
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) {
      setNotice(`We couldn't ${register ? 'create your account' : 'sign you in'}: ${result.error.message}`);
      return;
    }
    if (register) {
      setNotice('Check your inbox for a confirmation link, then sign in to continue.');
      return;
    }
    const returnTo = searchParams.get('returnTo');
    navigate(returnTo?.startsWith('/') ? returnTo : '/account');
  };
  return <main className="auth-page"><Link className="wordmark auth-wordmark" to="/"><span className="brand-symbol">c</span>cat'peas<span className="wordmark-dot">.</span></Link><section className="auth-card"><span className="eyebrow">{register ? 'A good thing starts here' : 'Good to see you again'}</span><h1>{register ? <>Make yourself<br />at home.</> : <>Welcome<br />back.</>}</h1><p>{register ? 'Create an account to keep your good finds close.' : 'Sign in to pick up right where you left off.'}</p><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" required minLength={6} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-dark" disabled={busy}>{busy ? 'One moment…' : register ? 'Create account' : 'Sign in'} <Icon name="arrow" /></button><p className="form-notice" aria-live="polite">{notice}</p></form><div className="auth-switch">{register ? 'Already have an account?' : 'New around here?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></div></section></main>;
}

function AccountPage() {
  const { user } = useStore();
  const [orders, setOrders] = useState<{ id: string; status: string; total: number; created_at: string }[]>([]);
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) {
      navigate('/login?returnTo=%2Faccount', { replace: true });
      return;
    }
    if (!supabase) return;
    void supabase.from('orders').select('id, status, total, created_at').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) {
        setNotice(`We couldn't load your orders: ${error.message}`);
        return;
      }
      setOrders(data ?? []);
    });
  }, [user, navigate]);
  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice(`We couldn't sign you out: ${error.message}`);
      return;
    }
    navigate('/');
  };
  if (!user) return null;
  return <main className="page-shell account-page"><div className="page-heading"><span className="eyebrow">Your corner of Cat'Peas</span><h1>Hello, again<span className="heading-period">.</span></h1><p>{user.email}</p></div><div className="account-panel"><div><span className="eyebrow">Order history</span><h2>Your good finds.</h2></div>{orders.length ? <div className="order-list">{orders.map((order) => <article key={order.id}><div><strong>Order #{order.id.slice(0, 8)}</strong><span>{new Date(order.created_at).toLocaleDateString()}</span></div><span className="order-status">{order.status}</span><strong>{formatPrice(Number(order.total))}</strong></article>)}</div> : <p>No orders yet — the next good thing could be yours.</p>}<p className="form-notice" aria-live="polite">{notice}</p><button className="text-link sign-out" onClick={signOut}>Sign out <Icon name="arrow" /></button></div></main>;
}

function LegacyRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const destination = useMemo(() => {
    const requested = decodeURIComponent(location.pathname.split('/').pop() ?? '').replace(/\.html$/i, '');
    const simple = requested.toLowerCase();
    const pages: Record<string, string> = { 'about': '/about', 'contact': '/contact', 'shop': '/shop', 'cart': '/cart', 'login': '/login', 'register': '/register', 'account': '/account', 'index': '/' };
    if (pages[simple]) return pages[simple];
    const product = catalog.find((item) => normalizeProductName(item.legacyName) === normalizeProductName(requested));
    return product ? `/products/${product.id}` : '/';
  }, [location.pathname]);
  useEffect(() => { navigate(destination, { replace: true }); }, [destination, navigate]);
  return <main className="route-loading" aria-label="Loading"><span /></main>;
}

function AppRoutes() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  return <><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/shop" element={<ShopPage />} /><Route path="/products/:id" element={<ProductPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage register />} /><Route path="/account" element={<AccountPage />} /><Route path="*" element={<LegacyRoute />} /></Routes>{!isAuthPage && <Footer />}</>;
}

export default function App() {
  return <StoreProvider><AppRoutes /></StoreProvider>;
}
