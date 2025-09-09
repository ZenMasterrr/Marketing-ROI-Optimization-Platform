import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const backendRes = await fetch('http://localhost:4000/estimate-cost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await backendRes.json();
  return NextResponse.json(data);
}