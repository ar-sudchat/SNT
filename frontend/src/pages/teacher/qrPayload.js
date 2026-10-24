// New payloads: KS1.<slug>.<token>. Legacy: SNT-... . The server validates the tenant; the client only recognises the shape.
export const isQrPayload = (code) => typeof code === 'string' && (code.startsWith('SNT-') || /^KS1\.[a-z0-9-]+\./.test(code));
