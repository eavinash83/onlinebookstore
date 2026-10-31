const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatPrice = (value) => currency.format(value);

export const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
