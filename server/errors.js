// Error with an HTTP status; the Express error handler sends its message to the client.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
