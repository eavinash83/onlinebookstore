// Placeholder product art (emoji on a tinted tile) — swap for <img src={product.imageUrl}> later.
export default function ProductImage({ product, size = 'md' }) {
  return (
    <div className={`product-image product-image-${size}`} style={{ background: product.color }} aria-hidden>
      <span>{product.emoji}</span>
    </div>
  );
}
