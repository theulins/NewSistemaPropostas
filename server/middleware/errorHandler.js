export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('Erro inesperado:', err);
  }
  res.status(status).json({
    message: err.message || 'Erro interno do servidor.',
    details: err.details || undefined,
  });
}
