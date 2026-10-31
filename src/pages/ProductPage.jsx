import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import QuantityControl from '../components/QuantityControl';
import Rating from '../components/Rating';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { getProduct, getRelatedProducts } from '../services/api';
import { formatPrice } from '../utils/format';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted, cartQtyFor } = useStore();
  const showToast = useToast();

  const [product, setProduct] = useState(undefined); // undefined = loading, null = not found
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setProduct(undefined);
    setQty(1);
    getProduct(id).then(async (p) => {
      setProduct(p);
      if (p) setRelated(await getRelatedProducts(p));
    });
  }, [id]);

  if (product === undefined) return <div className="container"><p className="muted">Loading…</p></div>;
  if (product === null) {
    return (
      <div className="container empty">
        <div className="empty-icon">🤷</div>
        <h2>Book not found</h2>
        <Link to="/" className="btn btn-primary">Back to the bookstore</Link>
      </div>
    );
  }

  const inCart = cartQtyFor(product.id);
  const available = product.stock - inCart;
  const wished = isWishlisted(product.id);

  const add = () => {
    addToCart(product, qty);
    showToast(`Added ${qty} × “${product.name}” to cart`);
    setQty(1);
  };

  const buyNow = () => {
    addToCart(product, qty);
    navigate('/checkout');
  };

  return (
    <div className="container">
      <nav className="breadcrumbs">
        <Link to="/">Books</Link> / <Link to={`/?category=${encodeURIComponent(product.category)}`}>{product.category}</Link> /{' '}
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <ProductImage product={product} size="lg" />
        <div className="product-info">
          <span className="muted">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="muted">by {product.author}</p>
          <Rating value={product.rating} reviews={product.reviews} />
          <p className="price price-lg">{formatPrice(product.price)}</p>
          <p>{product.description}</p>

          <p className={`stock ${product.stock === 0 ? 'out' : product.stock < 10 ? 'low' : ''}`}>
            {product.stock === 0 ? 'Out of stock' : product.stock < 10 ? `Only ${product.stock} left` : 'In stock'}
            {inCart > 0 && <span className="muted"> · {inCart} in your cart</span>}
          </p>

          {available > 0 ? (
            <div className="buy-row">
              <QuantityControl value={qty} max={available} onChange={setQty} />
              <button className="btn btn-primary" onClick={add}>Add to cart</button>
              <button className="btn btn-secondary" onClick={buyNow}>Buy now</button>
            </div>
          ) : (
            product.stock > 0 && <p className="muted">You have all available stock in your cart.</p>
          )}

          <button className="btn btn-ghost" onClick={() => toggleWishlist(product.id)} aria-pressed={wished}>
            {wished ? '♥ Saved to wishlist' : '♡ Add to wishlist'}
          </button>

          <ul className="perks">
            <li>🚚 Free shipping on orders over $50</li>
            <li>↩️ 30-day returns on unopened books</li>
            <li>🔒 Secure checkout</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <h2>You might also like</h2>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
