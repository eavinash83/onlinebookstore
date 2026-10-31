export default function Rating({ value, reviews }) {
  const full = Math.round(value);
  return (
    <span className="rating" title={`${value} out of 5`}>
      <span className="stars" aria-hidden>
        {'★'.repeat(full)}
        <span className="stars-empty">{'★'.repeat(5 - full)}</span>
      </span>
      <span className="rating-text">
        {value.toFixed(1)}
        {reviews != null && ` (${reviews.toLocaleString()})`}
      </span>
    </span>
  );
}
