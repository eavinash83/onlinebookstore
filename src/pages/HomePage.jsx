import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { getCategories, getProducts } from '../services/api';
import { formatPrice } from '../utils/format';

const PRICE_CEILING = 200;

export default function HomePage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const category = params.get('category') ?? 'All';
  const sort = params.get('sort') ?? 'featured';
  const maxPrice = Number(params.get('max') ?? PRICE_CEILING);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getProducts({ search, category, sort, maxPrice })
      .then((list) => !cancelled && setProducts(list))
      .catch(() => !cancelled && setError('Could not load books. Is the server running?'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, category, sort, maxPrice]);

  const updateParam = (key, value, defaultValue) => {
    const next = new URLSearchParams(params);
    if (value === defaultValue || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const hasFilters = search || category !== 'All' || sort !== 'featured' || maxPrice !== PRICE_CEILING;

  return (
    <div className="container">
      {!hasFilters && (
        <section className="hero">
          <div>
            <h1>Find your next great read.</h1>
            <p>Fiction, tech, history, cooking and more. Free shipping on orders over $50.</p>
          </div>
          <div className="hero-art" aria-hidden>📚</div>
        </section>
      )}

      <div className="chips" role="tablist" aria-label="Categories">
        {['All', ...categories].map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => updateParam('category', c, 'All')}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <p className="muted">
          {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'}`}
          {search && <> for “<strong>{search}</strong>”</>}
        </p>
        <div className="toolbar-controls">
          <label className="field-inline">
            Max price: <strong>{formatPrice(maxPrice)}</strong>
            <input
              type="range"
              min="10"
              max={PRICE_CEILING}
              step="10"
              value={maxPrice}
              onChange={(e) => updateParam('max', e.target.value, String(PRICE_CEILING))}
            />
          </label>
          <label className="field-inline">
            Sort
            <select value={sort} onChange={(e) => updateParam('sort', e.target.value, 'featured')}>
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="rating">Top rated</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card skeleton" />
          ))}
        </div>
      ) : error ? (
        <div className="empty">
          <div className="empty-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p className="muted">{error}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <h2>No products found</h2>
          <p className="muted">Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
