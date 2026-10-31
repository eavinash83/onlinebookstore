import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useStore } from '../context/StoreContext';
import { getProducts } from '../services/api';

export default function WishlistPage() {
  const { wishlist } = useStore();
  const [products, setProducts] = useState(null);

  useEffect(() => {
    if (wishlist.length === 0) {
      setProducts([]);
      return;
    }
    getProducts({ ids: wishlist }).then(setProducts);
  }, [wishlist]);

  // Filter locally too so un-hearting a card removes it instantly.
  const items = (products ?? []).filter((p) => wishlist.includes(p.id));

  if (products === null) return <div className="container"><p className="muted">Loading…</p></div>;

  if (items.length === 0) {
    return (
      <div className="container empty">
        <div className="empty-icon">♡</div>
        <h2>Your wishlist is empty</h2>
        <p className="muted">Tap the heart on any product to save it for later.</p>
        <Link to="/" className="btn btn-primary">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Wishlist</h1>
      <div className="grid">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
