export class ResourceNotFoundError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ResourceNotFoundError";
  }
}

export class DomainConflictError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DomainConflictError";
  }
}
