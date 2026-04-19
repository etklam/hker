export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'hker',
    time: new Date().toISOString(),
  })
}
