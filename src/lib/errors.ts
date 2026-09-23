export class ResourceNotFoundError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ResourceNotFoundError";
  }
}
