import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils/format';
import ProductImage from './ProductImage';
import Rating from './Rating';

export default function ProductCard({ product }) {
  const { addToCart, toggleWishlist, isWishlisted, cartQtyFor } = useStore();
  const showToast = useToast();
  const wished = isWishlisted(product.id);
  const soldOut = product.stock === 0;
  const maxedOut = cartQtyFor(product.id) >= product.stock;

  const onAdd = () => {
    addToCart(product);
    showToast(`Added “${product.name}” to cart`);
  };

  return (
    <article className="card product-card">
      <button
        className={`wish-btn ${wished ? 'active' : ''}`}
        onClick={() => toggleWishlist(product.id)}
        aria-pressed={wished}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {wished ? '♥' : '♡'}
      </button>
      <Link to={`/product/${product.id}`} className="product-card-link">
        <ProductImage product={product} />
        <div className="product-card-body">
          <span className="muted small">{product.category}</span>
          <h3>{product.name}</h3>
          <span className="muted small">{product.author}</span>
          <Rating value={product.rating} reviews={product.reviews} />
        </div>
      </Link>
      <div className="product-card-footer">
        <strong className="price">{formatPrice(product.price)}</strong>
        <button className="btn btn-primary btn-sm" onClick={onAdd} disabled={soldOut || maxedOut}>
          {soldOut ? 'Sold out' : maxedOut ? 'Max in cart' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}
