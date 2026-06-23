export const NextResponse = {
  json(body: unknown, init?: ResponseInit) {
    return Response.json(body, init);
  },
};
