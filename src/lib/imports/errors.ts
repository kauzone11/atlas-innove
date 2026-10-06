export class ImportInputError extends Error {
  constructor(public readonly code: string, public readonly rowNumber?: number, public readonly field?: string) {
    super(code);
    this.name = "ImportInputError";
  }
}
