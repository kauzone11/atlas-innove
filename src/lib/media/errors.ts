export class MediaError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly publicMessage: string) { super(code); this.name = "MediaError"; }
}
export const unavailableStorage = () => new MediaError("MEDIA_STORAGE_UNAVAILABLE", 503, "O envio de imagens está indisponível no momento. Você pode continuar usando seu perfil e publicações de texto.");
export const unavailableMedia = () => new MediaError("MEDIA_NOT_FOUND", 404, "Esta imagem não está disponível.");
